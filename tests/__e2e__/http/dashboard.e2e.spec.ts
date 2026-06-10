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
	EPaymentMethod,
} from '@/@core/enums/domain';

import { DatabaseService } from '@/shared/modules/database/database.service';

function dueDate(date: string): Date {
	return new Date(`${date}T12:00:00.000Z`);
}

describe('Dashboard API (e2e)', () => {
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

	async function createPatient(input: {
		clinicId: string;
		name: string;
		emailSuffix: string;
		contactStatus?: EContactStatus;
	}) {
		return db.patient.create({
			data: {
				clinicId: input.clinicId,
				name: input.name,
				email: `${input.emailSuffix}@example.com`,
				phone: '11999999999',
				preferredChannel: ECommunicationChannel.WhatsApp,
				contactStatus: input.contactStatus ?? EContactStatus.Active,
			},
		});
	}

	async function createAgreementWithInstallment(input: {
		clinicId: string;
		patientId: string;
		totalAmountCents: number;
		status: EDebtAgreementStatus;
		installmentAmountCents: number;
		paidAmountCents?: number;
		installmentStatus: EInstallmentStatus;
		dueDate: string;
		paidAt?: Date | null;
	}) {
		const agreement = await db.debtAgreement.create({
			data: {
				clinicId: input.clinicId,
				patientId: input.patientId,
				totalAmountCents: input.totalAmountCents,
				installmentsCount: 1,
				status: input.status,
			},
		});

		const installment = await db.installment.create({
			data: {
				clinicId: input.clinicId,
				debtAgreementId: agreement.id,
				installmentNumber: 1,
				dueDate: dueDate(input.dueDate),
				amountCents: input.installmentAmountCents,
				paidAmountCents: input.paidAmountCents ?? 0,
				status: input.installmentStatus,
				paidAt: input.paidAt ?? null,
				version: 0,
			},
		});

		return { agreement, installment };
	}

	it('should expose rich operational dashboard without crossing clinics', async () => {
		const clinic = await db.clinic.create({
			data: { name: 'Clinic Dashboard' },
		});
		const otherClinic = await db.clinic.create({
			data: { name: 'Clinic Other Dashboard' },
		});

		const topPatient = await createPatient({
			clinicId: clinic.id,
			name: 'Alice Prioritaria',
			emailSuffix: 'alice-prioritaria',
		});
		const dueTodayPatient = await createPatient({
			clinicId: clinic.id,
			name: 'Bruno Hoje',
			emailSuffix: 'bruno-hoje',
		});
		const dueSoonPatient = await createPatient({
			clinicId: clinic.id,
			name: 'Carla Em Breve',
			emailSuffix: 'carla-em-breve',
		});
		const paidPatient = await createPatient({
			clinicId: clinic.id,
			name: 'Diego Pago',
			emailSuffix: 'diego-pago',
		});
		const canceledPatient = await createPatient({
			clinicId: clinic.id,
			name: 'Eva Cancelada',
			emailSuffix: 'eva-cancelada',
			contactStatus: EContactStatus.DoNotContact,
		});
		await createPatient({
			clinicId: clinic.id,
			name: 'Fiona Sem Contato',
			emailSuffix: 'fiona-sem-contato',
			contactStatus: EContactStatus.MissingContactInfo,
		});

		const overdueSeed = await createAgreementWithInstallment({
			clinicId: clinic.id,
			patientId: topPatient.id,
			totalAmountCents: 1_000,
			status: EDebtAgreementStatus.Active,
			installmentAmountCents: 1_000,
			paidAmountCents: 200,
			installmentStatus: EInstallmentStatus.PartiallyPaid,
			dueDate: '2026-06-03',
		});
		const dueTodaySeed = await createAgreementWithInstallment({
			clinicId: clinic.id,
			patientId: dueTodayPatient.id,
			totalAmountCents: 700,
			status: EDebtAgreementStatus.Active,
			installmentAmountCents: 700,
			installmentStatus: EInstallmentStatus.Pending,
			dueDate: '2026-06-10',
		});
		const dueSoonSeed = await createAgreementWithInstallment({
			clinicId: clinic.id,
			patientId: dueSoonPatient.id,
			totalAmountCents: 500,
			status: EDebtAgreementStatus.Active,
			installmentAmountCents: 500,
			installmentStatus: EInstallmentStatus.Pending,
			dueDate: '2026-06-15',
		});
		const paidSeed = await createAgreementWithInstallment({
			clinicId: clinic.id,
			patientId: paidPatient.id,
			totalAmountCents: 900,
			status: EDebtAgreementStatus.Paid,
			installmentAmountCents: 900,
			paidAmountCents: 900,
			installmentStatus: EInstallmentStatus.Paid,
			dueDate: '2026-05-20',
			paidAt: new Date('2026-05-20T12:00:00.000Z'),
		});
		await createAgreementWithInstallment({
			clinicId: clinic.id,
			patientId: canceledPatient.id,
			totalAmountCents: 2_000,
			status: EDebtAgreementStatus.Canceled,
			installmentAmountCents: 2_000,
			installmentStatus: EInstallmentStatus.Pending,
			dueDate: '2026-06-01',
		});
		const otherClinicPatient = await createPatient({
			clinicId: otherClinic.id,
			name: 'Outra Clinica',
			emailSuffix: 'outra-clinica',
		});
		const otherClinicSeed = await createAgreementWithInstallment({
			clinicId: otherClinic.id,
			patientId: otherClinicPatient.id,
			totalAmountCents: 5_000,
			status: EDebtAgreementStatus.Active,
			installmentAmountCents: 5_000,
			installmentStatus: EInstallmentStatus.Pending,
			dueDate: '2026-06-01',
		});

		await db.payment.createMany({
			data: [
				{
					clinicId: clinic.id,
					installmentId: overdueSeed.installment.id,
					amountCents: 200,
					method: EPaymentMethod.Manual,
					externalReference: 'dashboard-payment-1',
					idempotencyKey: 'dashboard-payment-1',
					idempotencyPayloadHash: 'dashboard-payment-1-hash',
					paidAt: new Date('2026-06-09T12:00:00.000Z'),
				},
				{
					clinicId: clinic.id,
					installmentId: paidSeed.installment.id,
					amountCents: 900,
					method: EPaymentMethod.Pix,
					externalReference: 'dashboard-payment-2',
					idempotencyKey: 'dashboard-payment-2',
					idempotencyPayloadHash: 'dashboard-payment-2-hash',
					paidAt: new Date('2026-05-20T12:00:00.000Z'),
				},
				{
					clinicId: clinic.id,
					installmentId: dueTodaySeed.installment.id,
					amountCents: 300,
					method: EPaymentMethod.Pix,
					externalReference: 'dashboard-payment-future',
					idempotencyKey: 'dashboard-payment-future',
					idempotencyPayloadHash: 'dashboard-payment-future-hash',
					paidAt: new Date('2026-06-11T12:00:00.000Z'),
				},
			],
		});

		await db.communicationAttempt.createMany({
			data: [
				{
					clinicId: clinic.id,
					patientId: topPatient.id,
					installmentId: overdueSeed.installment.id,
					type: ECommunicationType.OverdueFollowUp,
					channel: ECommunicationChannel.Email,
					status: ECommunicationStatus.Generated,
					scheduledFor: null,
					sentAt: null,
					skippedReason: null,
					message: 'Follow up antigo',
					aiGenerated: false,
					templateKey: 'overdue_follow_up_email',
					createdAt: new Date('2026-06-03T12:00:00.000Z'),
				},
				{
					clinicId: clinic.id,
					patientId: topPatient.id,
					installmentId: overdueSeed.installment.id,
					type: ECommunicationType.OverdueSoftNotice,
					channel: ECommunicationChannel.WhatsApp,
					status: ECommunicationStatus.Generated,
					scheduledFor: new Date('2026-06-10T13:00:00.000Z'),
					sentAt: new Date('2026-06-10T13:00:00.000Z'),
					skippedReason: null,
					message: 'Soft notice hoje',
					aiGenerated: false,
					templateKey: 'overdue_soft_notice_whatsapp',
					createdAt: new Date('2026-06-10T13:00:00.000Z'),
				},
				{
					clinicId: clinic.id,
					patientId: dueTodayPatient.id,
					installmentId: dueTodaySeed.installment.id,
					type: ECommunicationType.DueDateReminder,
					channel: ECommunicationChannel.WhatsApp,
					status: ECommunicationStatus.Generated,
					scheduledFor: new Date('2026-06-10T15:00:00.000Z'),
					sentAt: null,
					skippedReason: null,
					message: 'Lembrete hoje',
					aiGenerated: false,
					templateKey: 'due_date_reminder_whatsapp',
					createdAt: new Date('2026-06-10T15:00:00.000Z'),
				},
				{
					clinicId: clinic.id,
					patientId: dueSoonPatient.id,
					installmentId: dueSoonSeed.installment.id,
					type: ECommunicationType.PreDueReminder,
					channel: ECommunicationChannel.WhatsApp,
					status: ECommunicationStatus.Generated,
					scheduledFor: new Date('2026-06-12T15:00:00.000Z'),
					sentAt: null,
					skippedReason: null,
					message: 'Futuro',
					aiGenerated: false,
					templateKey: 'pre_due_reminder_whatsapp',
					createdAt: new Date('2026-06-10T15:00:00.000Z'),
				},
				{
					clinicId: otherClinic.id,
					patientId: otherClinicPatient.id,
					installmentId: otherClinicSeed.installment.id,
					type: ECommunicationType.OverdueEscalation,
					channel: ECommunicationChannel.Email,
					status: ECommunicationStatus.Generated,
					scheduledFor: new Date('2026-06-10T10:00:00.000Z'),
					sentAt: null,
					skippedReason: null,
					message: 'Outra clinica',
					aiGenerated: false,
					templateKey: 'overdue_escalation_email',
					createdAt: new Date('2026-06-10T10:00:00.000Z'),
				},
			],
		});

		const response = await request(httpServer).get('/dashboard/summary').query({
			clinicId: clinic.id,
			referenceDate: '2026-06-10T15:00:00.000Z',
		});

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({
			clinicId: clinic.id,
			referenceDate: '2026-06-10T15:00:00.000Z',
			receivables: {
				totalDebtAmountCents: 2_200,
				totalPaidAmountCents: 200,
				totalOpenAmountCents: 2_000,
				totalOverdueAmountCents: 800,
			},
			agreements: {
				total: 5,
				active: 3,
				canceled: 1,
				fullyPaid: 1,
			},
			installments: {
				total: 4,
				open: 3,
				paid: 1,
				partiallyPaid: 1,
				overdue: 1,
				dueToday: 1,
				dueSoon: 1,
			},
			patients: {
				total: 6,
				withOpenDebt: 3,
				delinquent: 1,
				doNotContact: 1,
				missingContactInfo: 1,
			},
			collections: {
				totalAttempts: 3,
				generatedToday: 2,
				byChannel: {
					whatsapp: 2,
					email: 1,
				},
				byType: {
					preDueReminder: 0,
					dueDateReminder: 1,
					overdueSoftNotice: 1,
					overdueFollowUp: 1,
					overdueEscalation: 0,
				},
			},
			payments: {
				totalPayments: 2,
				paidAmountLast7DaysCents: 200,
				paidAmountLast30DaysCents: 1_100,
			},
		});
		expect(response.body.priority.topDelinquentPatients).toHaveLength(1);
		expect(response.body.priority.topDelinquentPatients[0]).toMatchObject({
			patientId: topPatient.id,
			patientName: 'Alice Prioritaria',
			totalOverdueCents: 800,
			overdueInstallments: 1,
			daysOverdue: 7,
			priorityScore: expect.any(Number),
			priorityReasons: expect.arrayContaining(['OVERDUE_DAYS']),
			lastCommunicationAt: '2026-06-10T13:00:00.000Z',
			suggestedAction: null,
			suggestedActionSkippedReason: 'PATIENT_ALREADY_CONTACTED_TODAY',
		});
	});

	it('should resolve referenceDate when query omits it', async () => {
		const clinic = await db.clinic.create({
			data: { name: 'Clinic Dashboard Default Date' },
		});

		const before = Date.now();
		const response = await request(httpServer).get('/dashboard/summary').query({
			clinicId: clinic.id,
		});
		const after = Date.now();

		expect(response.status).toBe(200);
		expect(response.body.clinicId).toBe(clinic.id);
		const resolved = new Date(response.body.referenceDate).getTime();
		expect(Number.isNaN(resolved)).toBe(false);
		expect(resolved).toBeGreaterThanOrEqual(before);
		expect(resolved).toBeLessThanOrEqual(after);
	});
});
