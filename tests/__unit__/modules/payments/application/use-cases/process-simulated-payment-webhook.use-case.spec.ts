import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockProxy } from 'vitest-mock-extended';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import {
	EInstallmentStatus,
	EPaymentMethod,
	EPaymentWebhookStatus,
} from '@/@core/enums/domain';

import { InstallmentRepository } from '@/modules/installments/application/repositories/installment.repository';
import { PaymentWebhookEventRepository } from '@/modules/payment-webhook-events/application/repositories/payment-webhook-event.repository';
import { PaymentWebhookEventEntity } from '@/modules/payment-webhook-events/domain/entities/payment-webhook-event.entity';
import { PaymentRepository } from '@/modules/payments/application/repositories/payment.repository';
import { SimulatedPaymentWebhookPayloadService } from '@/modules/payments/application/services/simulated-payment-webhook-payload.service';
import { ProcessSimulatedPaymentWebhookUseCase } from '@/modules/payments/application/use-cases/process-simulated-payment-webhook.use-case';
import { RegisterPaymentUseCase } from '@/modules/payments/application/use-cases/register-payment.use-case';

import { buildInstallmentEntity } from '#/data/builders/entities/installment.entity.builder';
import { buildPaymentEntity } from '#/data/builders/entities/payment.entity.builder';
import { makeInstallmentRepositoryMock } from '#/data/mocks/repositories/installment.repository.mock';
import { makePaymentWebhookEventRepositoryMock } from '#/data/mocks/repositories/payment-webhook-event.repository.mock';
import { makePaymentRepositoryMock } from '#/data/mocks/repositories/payment.repository.mock';

describe('ProcessSimulatedPaymentWebhookUseCase', () => {
	let webhookEventRepository: MockProxy<PaymentWebhookEventRepository>;
	let registerPaymentUseCase: MockProxy<RegisterPaymentUseCase>;
	let paymentRepository: MockProxy<PaymentRepository>;
	let installmentRepository: MockProxy<InstallmentRepository>;
	let useCase: ProcessSimulatedPaymentWebhookUseCase;

	const payloadService = new SimulatedPaymentWebhookPayloadService();
	const logger = {
		setContext: vi.fn(),
		assign: vi.fn(),
		info: vi.fn(),
	} as any;

	const input = {
		provider: 'pix_simulator',
		eventId: 'evt-1',
		clinicId: 'clinic-1',
		installmentId: 'installment-1',
		externalReference: 'ext-1',
		amountCents: 500,
		method: EPaymentMethod.Pix,
		paidAt: new Date('2026-06-10T13:00:00.000Z'),
	};

	beforeEach(() => {
		webhookEventRepository = makePaymentWebhookEventRepositoryMock();
		registerPaymentUseCase = {
			exec: vi.fn(),
		} as any;
		paymentRepository = makePaymentRepositoryMock();
		installmentRepository = makeInstallmentRepositoryMock();
		useCase = new ProcessSimulatedPaymentWebhookUseCase(
			payloadService,
			webhookEventRepository,
			registerPaymentUseCase,
			paymentRepository,
			installmentRepository,
			logger,
		);
	});

	function buildEvent(status = EPaymentWebhookStatus.Received) {
		const normalized = payloadService.normalize(input);
		return PaymentWebhookEventEntity.create({
			clinicId: EntityUuid.createFrom(normalized.clinicId),
			installmentId: EntityUuid.createFrom(normalized.installmentId),
			paymentId: null,
			provider: normalized.provider,
			eventId: normalized.eventId,
			externalReference: normalized.externalReference,
			payload: normalized,
			payloadHash: payloadService.hash(normalized),
			status,
			processedAt: null,
			errorCode: null,
			retryable: null,
			errorMessage: null,
		});
	}

	it('should create event, call register payment, and mark processed', async () => {
		webhookEventRepository.findByProviderAndEventId.mockResolvedValue(null);
		webhookEventRepository.create.mockResolvedValue();
		webhookEventRepository.update.mockResolvedValue();
		registerPaymentUseCase.exec.mockResolvedValue({
			paymentId: 'payment-1',
			installmentId: input.installmentId,
			amountCents: 500,
			method: EPaymentMethod.Pix,
			externalReference: 'ext-1',
			idempotencyKey: 'webhook:PIX_SIMULATOR:evt-1',
			paidAt: input.paidAt,
			installmentStatus: EInstallmentStatus.PartiallyPaid,
			installmentPaidAmountCents: 500,
			installmentRemainingAmountCents: 500,
			reused: false,
		});

		const output = await useCase.exec(input);

		expect(webhookEventRepository.create).toHaveBeenCalledOnce();
		expect(registerPaymentUseCase.exec).toHaveBeenCalledWith({
			clinicId: input.clinicId,
			installmentId: input.installmentId,
			externalReference: 'ext-1',
			idempotencyKey: 'webhook:PIX_SIMULATOR:evt-1',
			paidAt: input.paidAt,
			amountCents: 500,
			method: EPaymentMethod.Pix,
		});
		expect(output.webhookReplay).toBe(false);
		expect(output.paymentReused).toBe(false);
		expect(output.webhookEventId).toBeDefined();
		expect(output.provider).toBe('PIX_SIMULATOR');
		expect(output.eventId).toBe('evt-1');
		expect(output.webhookStatus).toBe(EPaymentWebhookStatus.Processed);
	});

	it('should rebuild processed replay safely', async () => {
		const event = buildEvent();
		event.markAsProcessed({
			paymentId: EntityUuid.createFrom('payment-1'),
			installmentId: EntityUuid.createFrom(input.installmentId),
			processedAt: new Date('2026-06-10T13:05:00.000Z'),
		});
		webhookEventRepository.findByProviderAndEventId.mockResolvedValue(event);
		paymentRepository.findByIdAndClinicId.mockResolvedValue(
			buildPaymentEntity({
				id: 'payment-1',
				clinicId: input.clinicId,
				installmentId: input.installmentId,
				idempotencyKey: 'webhook:PIX_SIMULATOR:evt-1',
				method: EPaymentMethod.Pix,
				externalReference: 'ext-1',
				amountCents: 500,
				paidAt: input.paidAt,
			}),
		);
		installmentRepository.findByIdAndClinicId.mockResolvedValue(
			buildInstallmentEntity({
				id: input.installmentId,
				clinicId: input.clinicId,
				amountCents: 1_000,
				paidAmountCents: 500,
				status: EInstallmentStatus.PartiallyPaid,
				version: 1,
			}),
		);

		const output = await useCase.exec(input);

		expect(output.webhookReplay).toBe(true);
		expect(output.paymentId).toBe('payment-1');
		expect(output.provider).toBe('PIX_SIMULATOR');
		expect(output.eventId).toBe('evt-1');
		expect(output.webhookStatus).toBe(EPaymentWebhookStatus.Processed);
		expect(output.paymentReused).toBe(true);
		expect(registerPaymentUseCase.exec).not.toHaveBeenCalled();
	});

	it('should reject same provider and event with different hash', async () => {
		const event = buildEvent();
		webhookEventRepository.findByProviderAndEventId.mockResolvedValue(event);

		await expect(
			useCase.exec({
				...input,
				amountCents: 700,
			}),
		).rejects.toThrowError(
			new ApplicationException('PAYMENT_WEBHOOK_EVENT_PAYLOAD_MISMATCH'),
		);
	});

	it('should reuse existing payment for new event with same external reference', async () => {
		webhookEventRepository.findByProviderAndEventId.mockResolvedValue(null);
		webhookEventRepository.create.mockResolvedValue();
		webhookEventRepository.update.mockResolvedValue();
		registerPaymentUseCase.exec.mockResolvedValue({
			paymentId: 'payment-1',
			installmentId: input.installmentId,
			amountCents: 500,
			method: EPaymentMethod.Pix,
			externalReference: 'ext-1',
			idempotencyKey: 'manual-or-old-key',
			paidAt: input.paidAt,
			installmentStatus: EInstallmentStatus.PartiallyPaid,
			installmentPaidAmountCents: 500,
			installmentRemainingAmountCents: 500,
			reused: true,
		});

		const output = await useCase.exec({
			...input,
			eventId: 'evt-2',
		});

		expect(output.webhookReplay).toBe(false);
		expect(output.paymentReused).toBe(true);
	});

	it('should rethrow persisted non-retryable failure without reprocessing', async () => {
		const event = buildEvent();
		event.markAsFailed({
			errorCode: 'INSTALLMENT_ALREADY_PAID',
			retryable: false,
		});
		webhookEventRepository.findByProviderAndEventId.mockResolvedValue(event);

		await expect(useCase.exec(input)).rejects.toThrowError(
			new ApplicationException('INSTALLMENT_ALREADY_PAID'),
		);
		expect(registerPaymentUseCase.exec).not.toHaveBeenCalled();
	});
});
