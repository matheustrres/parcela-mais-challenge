import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createAppFixture } from '../__helpers/app-fixture';
import { cleanDatabase } from '../__helpers/database-cleaner';

import {
	ECommunicationChannel,
	ECommunicationStatus,
	ECommunicationType,
	EContactStatus,
	EDebtAgreementStatus,
	EInstallmentStatus,
} from '@/@core/enums/domain';

import { DatabaseService } from '@/shared/modules/database/database.service';

function dueDate(date: string): Date {
	return new Date(`${date}T12:00:00.000Z`);
}

describe('Delinquents API (e2e)', () => {
	let db: DatabaseService;
	let httpServer: Parameters<typeof request>[0];

	beforeAll(async () => {
		const fixture = await createAppFixture({
			shouldClearAllDb: true,
		});

		db = fixture.db;
		httpServer = fixture.app.getHttpServer();
	});

	afterEach(async () => {
		await cleanDatabase(db);
	});

	async function createPatientAgreementInstallment(input: {
		clinicId: string;
		patientName: string;
		dueDate: string;
		amountCents: number;
		installmentNumber?: number;
		patientEmail?: string;
	}) {
		const patient = await db.patient.create({
			data: {
				clinicId: input.clinicId,
				name: input.patientName,
				email:
					input.patientEmail ??
					`${input.patientName.toLowerCase()}@example.com`,
				phone: '11999999999',
				preferredChannel: ECommunicationChannel.WhatsApp,
				contactStatus: EContactStatus.Active,
			},
		});
		const agreement = await db.debtAgreement.create({
			data: {
				clinicId: input.clinicId,
				patientId: patient.id,
				totalAmountCents: input.amountCents,
				installmentsCount: 1,
				status: EDebtAgreementStatus.Active,
			},
		});
		const installment = await db.installment.create({
			data: {
				clinicId: input.clinicId,
				debtAgreementId: agreement.id,
				installmentNumber: input.installmentNumber ?? 1,
				dueDate: dueDate(input.dueDate),
				amountCents: input.amountCents,
				paidAmountCents: 0,
				status: EInstallmentStatus.Pending,
				paidAt: null,
				version: 0,
			},
		});

		return { patient, agreement, installment };
	}

	it('should group by patient, calculate score, order by priority and not cross clinics', async () => {
		const clinicA = await db.clinic.create({
			data: { name: 'Clinic Delinquents A' },
		});
		const clinicB = await db.clinic.create({
			data: { name: 'Clinic Delinquents B' },
		});

		const patientTop = await db.patient.create({
			data: {
				clinicId: clinicA.id,
				name: 'Alice Prioritaria',
				email: 'alice.prioritaria@example.com',
				phone: '11911111111',
				preferredChannel: ECommunicationChannel.WhatsApp,
				contactStatus: EContactStatus.Active,
			},
		});
		const patientLower = await db.patient.create({
			data: {
				clinicId: clinicA.id,
				name: 'Bianca Menor',
				email: 'bianca.menor@example.com',
				phone: '11922222222',
				preferredChannel: ECommunicationChannel.WhatsApp,
				contactStatus: EContactStatus.Active,
			},
		});

		const agreementTop = await db.debtAgreement.create({
			data: {
				clinicId: clinicA.id,
				patientId: patientTop.id,
				totalAmountCents: 100_000,
				installmentsCount: 2,
				status: EDebtAgreementStatus.Active,
			},
		});
		await db.installment.createMany({
			data: [
				{
					clinicId: clinicA.id,
					debtAgreementId: agreementTop.id,
					installmentNumber: 1,
					dueDate: dueDate('2026-05-20'),
					amountCents: 50_000,
					paidAmountCents: 0,
					status: EInstallmentStatus.Pending,
					paidAt: null,
					version: 0,
				},
				{
					clinicId: clinicA.id,
					debtAgreementId: agreementTop.id,
					installmentNumber: 2,
					dueDate: dueDate('2026-06-01'),
					amountCents: 50_000,
					paidAmountCents: 0,
					status: EInstallmentStatus.Pending,
					paidAt: null,
					version: 0,
				},
			],
		});

		const agreementLower = await db.debtAgreement.create({
			data: {
				clinicId: clinicA.id,
				patientId: patientLower.id,
				totalAmountCents: 5_000,
				installmentsCount: 1,
				status: EDebtAgreementStatus.Active,
			},
		});
		const lowerInstallment = await db.installment.create({
			data: {
				clinicId: clinicA.id,
				debtAgreementId: agreementLower.id,
				installmentNumber: 1,
				dueDate: dueDate('2026-06-08'),
				amountCents: 5_000,
				paidAmountCents: 0,
				status: EInstallmentStatus.Pending,
				paidAt: null,
				version: 0,
			},
		});
		await db.communicationAttempt.create({
			data: {
				clinicId: clinicA.id,
				patientId: patientLower.id,
				installmentId: lowerInstallment.id,
				type: ECommunicationType.OverdueSoftNotice,
				channel: ECommunicationChannel.WhatsApp,
				status: ECommunicationStatus.Generated,
				scheduledFor: new Date('2026-06-10T13:00:00.000Z'),
				sentAt: null,
				skippedReason: null,
				message: 'Tentativa recente',
				aiGenerated: false,
				templateKey: 'overdue_soft_notice_whatsapp',
			},
		});

		const otherClinicSeed = await createPatientAgreementInstallment({
			clinicId: clinicB.id,
			patientName: 'Carlos Outra Clinica',
			dueDate: '2026-05-15',
			amountCents: 200_000,
		});

		const response = await request(httpServer).get('/delinquents').query({
			clinicId: clinicA.id,
			referenceDate: '2026-06-10T13:00:00.000Z',
			limit: '10',
			offset: '0',
		});

		expect(response.status).toBe(200);
		expect(response.body.total).toBe(2);
		expect(response.body.items[0]).toMatchObject({
			patientId: patientTop.id,
			patientName: 'Alice Prioritaria',
			overdueInstallments: 2,
			totalOverdueCents: 100_000,
		});
		expect(response.body.items[1]).toMatchObject({
			patientId: patientLower.id,
			patientName: 'Bianca Menor',
			overdueInstallments: 1,
			totalOverdueCents: 5_000,
		});
		expect(response.body.items[0].priorityScore).toBeGreaterThan(
			response.body.items[1].priorityScore,
		);
		expect(
			response.body.items.map((item: { patientId: string }) => item.patientId),
		).not.toContain(otherClinicSeed.patient.id);
	});
});
