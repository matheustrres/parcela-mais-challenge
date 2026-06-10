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

function emailFromName(name: string): string {
	const slug = name
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '.')
		.replace(/^\.+|\.+$/g, '');

	return `${slug}@example.com`;
}

describe('CollectionRules API (e2e)', () => {
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

	async function seedAgreementPatientInstallment(input: {
		clinicId: string;
		patientName: string;
		contactStatus?: EContactStatus;
		email?: string | null;
		phone?: string | null;
		dueDate: string;
		status?: EInstallmentStatus;
		paidAmountCents?: number;
		amountCents?: number;
	}) {
		const patient = await db.patient.create({
			data: {
				clinicId: input.clinicId,
				name: input.patientName,
				email: input.email ?? emailFromName(input.patientName),
				phone: input.phone ?? '11999999999',
				preferredChannel:
					(input.phone ?? '11999999999') !== null
						? ECommunicationChannel.WhatsApp
						: (input.email ?? null) !== null
							? ECommunicationChannel.Email
							: null,
				contactStatus: input.contactStatus ?? EContactStatus.Active,
			},
		});
		const agreement = await db.debtAgreement.create({
			data: {
				clinicId: input.clinicId,
				patientId: patient.id,
				totalAmountCents: input.amountCents ?? 900,
				installmentsCount: 1,
				status: EDebtAgreementStatus.Active,
			},
		});
		const installment = await db.installment.create({
			data: {
				clinicId: input.clinicId,
				debtAgreementId: agreement.id,
				installmentNumber: 1,
				dueDate: dueDate(input.dueDate),
				amountCents: input.amountCents ?? 900,
				paidAmountCents: input.paidAmountCents ?? 0,
				status: input.status ?? EInstallmentStatus.Pending,
				paidAt: null,
				version: 0,
			},
		});

		return { patient, agreement, installment };
	}

	it('should generate D-3 reminder', async () => {
		const clinic = await db.clinic.create({
			data: { name: 'Clinic D-3' },
		});
		const { installment } = await seedAgreementPatientInstallment({
			clinicId: clinic.id,
			patientName: 'Pre Due',
			dueDate: '2026-06-13',
		});

		const response = await request(httpServer)
			.post('/collection-rules/run')
			.send({
				clinicId: clinic.id,
				referenceDate: '2026-06-10T13:00:00.000Z',
			});

		expect(response.status).toBe(201);
		expect(response.body.generated).toBe(1);
		expect(response.body.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					installmentId: installment.id,
					type: ECommunicationType.PreDueReminder,
					channel: ECommunicationChannel.WhatsApp,
					status: 'GENERATED',
				}),
			]),
		);
	});

	it('should generate D+7 in WhatsApp and Email and expose communication attempts', async () => {
		const clinic = await db.clinic.create({
			data: { name: 'Clinic D+7' },
		});
		const { patient } = await seedAgreementPatientInstallment({
			clinicId: clinic.id,
			patientName: 'Carla Demo',
			dueDate: '2026-06-03',
		});

		const runResponse = await request(httpServer)
			.post('/collection-rules/run')
			.send({
				clinicId: clinic.id,
				referenceDate: '2026-06-10T13:00:00.000Z',
			});

		expect(runResponse.status).toBe(201);
		expect(runResponse.body.generated).toBe(2);

		const attemptsResponse = await request(httpServer)
			.get('/communication-attempts')
			.query({
				clinicId: clinic.id,
				limit: '10',
				offset: '0',
			});

		expect(attemptsResponse.status).toBe(200);
		expect(attemptsResponse.body.total).toBe(2);
		expect(
			attemptsResponse.body.items.map(
				(item: { channel: string }) => item.channel,
			),
		).toEqual(expect.arrayContaining(['WHATSAPP', 'EMAIL']));
		expect(attemptsResponse.body.items[0].patient.id).toBe(patient.id);
	});

	it('should skip DO_NOT_CONTACT patient', async () => {
		const clinic = await db.clinic.create({
			data: { name: 'Clinic DNC' },
		});
		const { installment } = await seedAgreementPatientInstallment({
			clinicId: clinic.id,
			patientName: 'Fabio DNC',
			contactStatus: EContactStatus.DoNotContact,
			dueDate: '2026-06-03',
		});

		const response = await request(httpServer)
			.post('/collection-rules/run')
			.send({
				clinicId: clinic.id,
				referenceDate: '2026-06-10T13:00:00.000Z',
			});

		expect(response.status).toBe(201);
		expect(response.body.generated).toBe(0);
		expect(response.body.skipped).toBe(1);
		expect(response.body.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					installmentId: installment.id,
					status: 'SKIPPED',
					skippedReason: 'PATIENT_DO_NOT_CONTACT',
				}),
			]),
		);
	});

	it('should skip installment with recent partial payment', async () => {
		const clinic = await db.clinic.create({
			data: { name: 'Clinic Partial Skip' },
		});
		const { installment } = await seedAgreementPatientInstallment({
			clinicId: clinic.id,
			patientName: 'Eva Partial',
			dueDate: '2026-06-08',
			status: EInstallmentStatus.PartiallyPaid,
			paidAmountCents: 200,
			amountCents: 900,
		});
		await db.payment.create({
			data: {
				clinicId: clinic.id,
				installmentId: installment.id,
				amountCents: 200,
				method: EPaymentMethod.Manual,
				externalReference: 'partial-recent-1',
				idempotencyKey: 'partial-recent-1',
				idempotencyPayloadHash: 'hash-partial-recent-1',
				paidAt: new Date('2026-06-10T12:30:00.000Z'),
			},
		});

		const response = await request(httpServer)
			.post('/collection-rules/run')
			.send({
				clinicId: clinic.id,
				referenceDate: '2026-06-10T13:00:00.000Z',
			});

		expect(response.status).toBe(201);
		expect(response.body.generated).toBe(0);
		expect(response.body.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					installmentId: installment.id,
					status: 'SKIPPED',
					skippedReason: 'RECENT_PARTIAL_PAYMENT',
				}),
			]),
		);
	});

	it('should not duplicate existing communication attempt', async () => {
		const clinic = await db.clinic.create({
			data: { name: 'Clinic Dedupe' },
		});
		const { patient, installment } = await seedAgreementPatientInstallment({
			clinicId: clinic.id,
			patientName: 'Dora Dedupe',
			dueDate: '2026-06-03',
		});
		await db.communicationAttempt.create({
			data: {
				clinicId: clinic.id,
				patientId: patient.id,
				installmentId: installment.id,
				type: ECommunicationType.OverdueFollowUp,
				channel: ECommunicationChannel.WhatsApp,
				status: ECommunicationStatus.Generated,
				scheduledFor: new Date('2026-06-09T13:00:00.000Z'),
				sentAt: null,
				skippedReason: null,
				message: 'Mensagem anterior',
				aiGenerated: false,
				templateKey: 'overdue_follow_up_whatsapp',
			},
		});

		const response = await request(httpServer)
			.post('/collection-rules/run')
			.send({
				clinicId: clinic.id,
				referenceDate: '2026-06-10T13:00:00.000Z',
			});

		expect(response.status).toBe(201);
		expect(response.body.generated).toBe(1);
		expect(response.body.skipped).toBe(1);
		expect(response.body.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					installmentId: installment.id,
					channel: ECommunicationChannel.WhatsApp,
					status: 'SKIPPED',
					skippedReason: 'COMMUNICATION_TYPE_ALREADY_EXISTS',
				}),
				expect.objectContaining({
					installmentId: installment.id,
					channel: ECommunicationChannel.Email,
					status: 'GENERATED',
				}),
			]),
		);
	});
});
