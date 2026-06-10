import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createAppFixture } from '../__helpers/app-fixture';
import { cleanDatabase } from '../__helpers/database-cleaner';

import {
	ECommunicationChannel,
	EContactStatus,
	EDebtAgreementStatus,
	EInstallmentStatus,
	EPaymentMethod,
	EPaymentWebhookStatus,
} from '@/@core/enums/domain';

import { DatabaseService } from '@/shared/modules/database/database.service';

function dueDate(date: string): Date {
	return new Date(`${date}T12:00:00.000Z`);
}

describe('Payments API (e2e)', () => {
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

	async function seedInstallment(amountCents = 1_000) {
		const clinic = await db.clinic.create({
			data: { name: 'Clinic Payments' },
		});
		const patient = await db.patient.create({
			data: {
				clinicId: clinic.id,
				name: 'Bruno Pagador',
				email: 'bruno.pagador@example.com',
				phone: '11888888888',
				preferredChannel: ECommunicationChannel.Email,
				contactStatus: EContactStatus.Active,
			},
		});
		const agreement = await db.debtAgreement.create({
			data: {
				clinicId: clinic.id,
				patientId: patient.id,
				totalAmountCents: amountCents,
				installmentsCount: 1,
				status: EDebtAgreementStatus.Active,
			},
		});
		const installment = await db.installment.create({
			data: {
				clinicId: clinic.id,
				debtAgreementId: agreement.id,
				installmentNumber: 1,
				dueDate: dueDate('2026-06-08'),
				amountCents,
				paidAmountCents: 0,
				status: EInstallmentStatus.Pending,
				paidAt: null,
				version: 0,
			},
		});

		return { clinic, patient, agreement, installment };
	}

	it('should mark installment as PAID on total payment', async () => {
		const { clinic, installment } = await seedInstallment(1_000);

		const response = await request(httpServer).post('/payments').send({
			clinicId: clinic.id,
			installmentId: installment.id,
			amountCents: 1_000,
			method: EPaymentMethod.Pix,
			externalReference: 'payment-total-1',
			idempotencyKey: 'payment-total-1',
			paidAt: '2026-06-10T13:00:00.000Z',
		});

		expect(response.status).toBe(201);
		expect(response.body.installmentStatus).toBe(EInstallmentStatus.Paid);
		expect(response.body.installmentRemainingAmountCents).toBe(0);
	});

	it('should mark installment as PARTIALLY_PAID on partial payment and expose dashboard summary', async () => {
		const { clinic, installment } = await seedInstallment(1_000);

		const response = await request(httpServer).post('/payments').send({
			clinicId: clinic.id,
			installmentId: installment.id,
			amountCents: 400,
			method: EPaymentMethod.Manual,
			externalReference: 'payment-partial-1',
			idempotencyKey: 'payment-partial-1',
			paidAt: '2026-06-10T13:00:00.000Z',
		});

		expect(response.status).toBe(201);
		expect(response.body.installmentStatus).toBe(
			EInstallmentStatus.PartiallyPaid,
		);
		expect(response.body.installmentRemainingAmountCents).toBe(600);

		const dashboardResponse = await request(httpServer)
			.get('/dashboard/summary')
			.query({
				clinicId: clinic.id,
				referenceDate: '2026-06-10T15:00:00.000Z',
			});

		expect(dashboardResponse.status).toBe(200);
		expect(dashboardResponse.body).toMatchObject({
			clinicId: clinic.id,
			referenceDate: '2026-06-10T15:00:00.000Z',
			receivables: {
				totalDebtAmountCents: 1_000,
				totalPaidAmountCents: 400,
				totalOpenAmountCents: 600,
				totalOverdueAmountCents: 600,
			},
			installments: {
				open: 1,
				paid: 0,
				partiallyPaid: 1,
				overdue: 1,
			},
			payments: {
				totalPayments: 1,
				paidAmountLast7DaysCents: 400,
				paidAmountLast30DaysCents: 400,
			},
		});
	});

	it('should return existing payment on idempotencyKey replay', async () => {
		const { clinic, installment } = await seedInstallment(1_000);

		const payload = {
			clinicId: clinic.id,
			installmentId: installment.id,
			amountCents: 400,
			method: EPaymentMethod.Manual,
			externalReference: 'payment-idem-1',
			idempotencyKey: 'payment-idem-1',
			paidAt: '2026-06-10T13:00:00.000Z',
		};

		const first = await request(httpServer).post('/payments').send(payload);
		const replay = await request(httpServer).post('/payments').send(payload);

		expect(first.status).toBe(201);
		expect(replay.status).toBe(201);
		expect(replay.body.paymentId).toBe(first.body.paymentId);
	});

	it('should return existing payment on externalReference replay', async () => {
		const { clinic, installment } = await seedInstallment(1_000);

		const first = await request(httpServer).post('/payments').send({
			clinicId: clinic.id,
			installmentId: installment.id,
			amountCents: 400,
			method: EPaymentMethod.Manual,
			externalReference: 'payment-ext-1',
			idempotencyKey: 'payment-ext-1a',
			paidAt: '2026-06-10T13:00:00.000Z',
		});
		const replay = await request(httpServer).post('/payments').send({
			clinicId: clinic.id,
			installmentId: installment.id,
			amountCents: 400,
			method: EPaymentMethod.Manual,
			externalReference: 'payment-ext-1',
			idempotencyKey: 'payment-ext-1b',
			paidAt: '2026-06-10T13:00:00.000Z',
		});

		expect(first.status).toBe(201);
		expect(replay.status).toBe(201);
		expect(replay.body.paymentId).toBe(first.body.paymentId);
	});

	it('should return 409 when same idempotency key is replayed with different payload', async () => {
		const { clinic, installment } = await seedInstallment(1_000);

		const first = await request(httpServer).post('/payments').send({
			clinicId: clinic.id,
			installmentId: installment.id,
			amountCents: 400,
			method: EPaymentMethod.Manual,
			externalReference: 'payment-mismatch-1',
			idempotencyKey: 'payment-mismatch-1',
			paidAt: '2026-06-10T13:00:00.000Z',
		});
		const replay = await request(httpServer).post('/payments').send({
			clinicId: clinic.id,
			installmentId: installment.id,
			amountCents: 500,
			method: EPaymentMethod.Manual,
			externalReference: 'payment-mismatch-2',
			idempotencyKey: 'payment-mismatch-1',
			paidAt: '2026-06-10T13:00:00.000Z',
		});

		expect(first.status).toBe(201);
		expect(replay.status).toBe(409);
		expect(replay.body.detail).toBe('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH');
	});

	it('should process simulated webhook as partial payment and expose dashboard summary', async () => {
		const { clinic, installment } = await seedInstallment(1_000);

		const response = await request(httpServer)
			.post('/webhooks/payments/simulated')
			.send({
				clinicId: clinic.id,
				installmentId: installment.id,
				provider: 'pix_simulator',
				eventId: 'evt-partial-1',
				externalReference: 'webhook-partial-1',
				amountCents: 400,
				method: EPaymentMethod.Pix,
				paidAt: '2026-06-10T13:00:00.000Z',
			});

		expect(response.status).toBe(201);
		expect(response.body).toMatchObject({
			provider: 'PIX_SIMULATOR',
			eventId: 'evt-partial-1',
			webhookStatus: EPaymentWebhookStatus.Processed,
			webhookReplay: false,
			paymentReused: false,
			installmentStatus: EInstallmentStatus.PartiallyPaid,
			installmentRemainingAmountCents: 600,
		});
		expect(response.body.webhookEventId).toBeDefined();

		const dashboardResponse = await request(httpServer)
			.get('/dashboard/summary')
			.query({
				clinicId: clinic.id,
				referenceDate: '2026-06-10T15:00:00.000Z',
			});

		expect(dashboardResponse.status).toBe(200);
		expect(dashboardResponse.body.payments.totalPayments).toBe(1);
		expect(dashboardResponse.body.receivables.totalPaidAmountCents).toBe(400);
	});

	it('should mark installment as PAID on total simulated webhook', async () => {
		const { clinic, installment } = await seedInstallment(1_000);

		const response = await request(httpServer)
			.post('/webhooks/payments/simulated')
			.send({
				clinicId: clinic.id,
				installmentId: installment.id,
				provider: 'pix_simulator',
				eventId: 'evt-total-1',
				externalReference: 'webhook-total-1',
				amountCents: 1_000,
				method: EPaymentMethod.Boleto,
				paidAt: '2026-06-10T13:00:00.000Z',
			});

		expect(response.status).toBe(201);
		expect(response.body.installmentStatus).toBe(EInstallmentStatus.Paid);
		expect(response.body.installmentRemainingAmountCents).toBe(0);
	});

	it('should absorb identical simulated webhook replay with 200 and single financial record', async () => {
		const { clinic, installment } = await seedInstallment(1_000);
		const payload = {
			clinicId: clinic.id,
			installmentId: installment.id,
			provider: 'pix_simulator',
			eventId: 'evt-replay-1',
			externalReference: 'webhook-replay-1',
			amountCents: 1_000,
			method: EPaymentMethod.Pix,
			paidAt: '2026-06-10T13:00:00.000Z',
		};

		const first = await request(httpServer)
			.post('/webhooks/payments/simulated')
			.send(payload);
		const replay = await request(httpServer)
			.post('/webhooks/payments/simulated')
			.send(payload);

		expect(first.status).toBe(201);
		expect(replay.status).toBe(200);
		expect(replay.body.paymentId).toBe(first.body.paymentId);
		expect(replay.body.webhookEventId).toBe(first.body.webhookEventId);
		expect(replay.body.provider).toBe('PIX_SIMULATOR');
		expect(replay.body.eventId).toBe('evt-replay-1');
		expect(replay.body.webhookStatus).toBe(EPaymentWebhookStatus.Processed);
		expect(replay.body.webhookReplay).toBe(true);
		expect(replay.body.paymentReused).toBe(true);
		expect(await db.payment.count()).toBe(1);
		expect(await db.paymentWebhookEvent.count()).toBe(1);
	});

	it('should return 409 on divergent webhook payload for same provider and event', async () => {
		const { clinic, installment } = await seedInstallment(1_000);
		const basePayload = {
			clinicId: clinic.id,
			installmentId: installment.id,
			provider: 'pix_simulator',
			eventId: 'evt-mismatch-1',
			externalReference: 'webhook-mismatch-1',
			amountCents: 400,
			method: EPaymentMethod.Pix,
			paidAt: '2026-06-10T13:00:00.000Z',
		};

		const first = await request(httpServer)
			.post('/webhooks/payments/simulated')
			.send(basePayload);
		const replay = await request(httpServer)
			.post('/webhooks/payments/simulated')
			.send({
				...basePayload,
				amountCents: 500,
			});

		expect(first.status).toBe(201);
		expect(replay.status).toBe(409);
		expect(replay.body.detail).toBe('PAYMENT_WEBHOOK_EVENT_PAYLOAD_MISMATCH');
	});

	it('should reuse existing payment on new event with same external reference', async () => {
		const { clinic, installment } = await seedInstallment(1_000);
		await request(httpServer).post('/payments').send({
			clinicId: clinic.id,
			installmentId: installment.id,
			amountCents: 400,
			method: EPaymentMethod.Pix,
			externalReference: 'shared-ext-1',
			idempotencyKey: 'manual-shared-ext-1',
			paidAt: '2026-06-10T13:00:00.000Z',
		});

		const response = await request(httpServer)
			.post('/webhooks/payments/simulated')
			.send({
				clinicId: clinic.id,
				installmentId: installment.id,
				provider: 'pix_simulator',
				eventId: 'evt-reuse-1',
				externalReference: 'shared-ext-1',
				amountCents: 400,
				method: EPaymentMethod.Pix,
				paidAt: '2026-06-10T13:00:00.000Z',
			});

		expect(response.status).toBe(201);
		expect(response.body.webhookReplay).toBe(false);
		expect(response.body.paymentReused).toBe(true);
		expect(await db.payment.count()).toBe(1);
	});

	it('should reject unsupported webhook payment method', async () => {
		const { clinic, installment } = await seedInstallment(1_000);

		const response = await request(httpServer)
			.post('/webhooks/payments/simulated')
			.send({
				clinicId: clinic.id,
				installmentId: installment.id,
				provider: 'pix_simulator',
				eventId: 'evt-method-1',
				externalReference: 'webhook-method-1',
				amountCents: 400,
				method: EPaymentMethod.Manual,
				paidAt: '2026-06-10T13:00:00.000Z',
			});

		expect(response.status).toBe(400);
		expect(response.body.detail).toContain(
			'method must be one of: PIX, BOLETO',
		);
	});
});
