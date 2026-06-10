import { describe, expect, it, vi } from 'vitest';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { DomainException } from '@/@core/domain/exceptions/domain-exception';
import { EPaymentWebhookStatus } from '@/@core/enums/domain';

import { PaymentWebhookEventEntity } from '@/modules/payment-webhook-events/domain/entities/payment-webhook-event.entity';

describe('PaymentWebhookEventEntity', () => {
	const makeProps = () => ({
		clinicId: EntityUuid.createFrom('clinic-id'),
		installmentId: EntityUuid.createFrom('installment-id'),
		paymentId: null,
		provider: ' provider ',
		eventId: ' event-id ',
		externalReference: ' ext-ref ',
		payload: { event: 'payment.received' },
		payloadHash: ' hash-1 ',
		status: EPaymentWebhookStatus.Received,
		processedAt: null,
		errorCode: null,
		retryable: null,
		errorMessage: null,
	});

	describe('.create', () => {
		it('should create webhook event with normalized strings', () => {
			const entity = PaymentWebhookEventEntity.create(makeProps());
			expect(entity.id).toBeInstanceOf(EntityUuid);
			expect(entity.provider).toBe('PROVIDER');
			expect(entity.eventId).toBe('event-id');
			expect(entity.externalReference).toBe('ext-ref');
			expect(entity.payloadHash).toBe('hash-1');
			expect(entity.status).toBe(EPaymentWebhookStatus.Received);
		});

		it('should reject empty provider', () => {
			expect(() =>
				PaymentWebhookEventEntity.create({
					...makeProps(),
					provider: ' ',
				}),
			).toThrowError(new DomainException('PAYMENT_WEBHOOK_PROVIDER_REQUIRED'));
		});

		it('should reject processed status without payment id and processedAt', () => {
			expect(() =>
				PaymentWebhookEventEntity.create({
					...makeProps(),
					status: EPaymentWebhookStatus.Processed,
				}),
			).toThrowError(
				new DomainException(
					'PROCESSED_PAYMENT_WEBHOOK_REQUIRES_PAYMENT_ID_INSTALLMENT_ID_AND_PROCESSED_AT',
				),
			);
		});
	});

	describe('.markAsProcessed', () => {
		it('should mark event as processed set payment id processedAt and touch updatedAt', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2024-07-02T10:00:00.000Z'));
			const entity = PaymentWebhookEventEntity.create(makeProps());
			const paymentId = EntityUuid.createFrom('payment-id');
			const installmentId = EntityUuid.createFrom('installment-id');
			const processedAt = new Date('2024-07-02T09:00:00.000Z');
			entity.markAsProcessed({ paymentId, installmentId, processedAt });
			expect(entity.paymentId?.toString()).toBe('payment-id');
			expect(entity.processedAt).toEqual(processedAt);
			expect(entity.status).toBe(EPaymentWebhookStatus.Processed);
			expect(entity.errorMessage).toBeNull();
			expect(entity.updatedAt).toEqual(new Date('2024-07-02T10:00:00.000Z'));
			vi.useRealTimers();
		});
	});

	describe('.markAsDuplicated', () => {
		it('should mark event as duplicated and touch updatedAt', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2024-07-03T10:00:00.000Z'));
			const entity = PaymentWebhookEventEntity.create(makeProps());
			entity.markAsDuplicated();
			expect(entity.status).toBe(EPaymentWebhookStatus.Duplicated);
			expect(entity.updatedAt).toEqual(new Date('2024-07-03T10:00:00.000Z'));
			vi.useRealTimers();
		});
	});

	describe('.markAsFailed', () => {
		it('should mark event as failed store trimmed reason and touch updatedAt', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2024-07-04T10:00:00.000Z'));
			const entity = PaymentWebhookEventEntity.create(makeProps());
			entity.markAsFailed({
				errorCode: '  WEBHOOK_PROCESSING_FAILED  ',
				retryable: true,
				errorMessage: '  invalid signature  ',
			});
			expect(entity.status).toBe(EPaymentWebhookStatus.Failed);
			expect(entity.errorCode).toBe('WEBHOOK_PROCESSING_FAILED');
			expect(entity.retryable).toBe(true);
			expect(entity.errorMessage).toBe('invalid signature');
			expect(entity.updatedAt).toEqual(new Date('2024-07-04T10:00:00.000Z'));
			vi.useRealTimers();
		});

		it('should reject empty error code', () => {
			const entity = PaymentWebhookEventEntity.create(makeProps());
			expect(() =>
				entity.markAsFailed({
					errorCode: ' ',
					retryable: true,
				}),
			).toThrowError(
				new DomainException('PAYMENT_WEBHOOK_ERROR_CODE_REQUIRED'),
			);
		});
	});

	describe('.prepareForRetry', () => {
		it('should move retryable failed event back to received', () => {
			const entity = PaymentWebhookEventEntity.create(makeProps());
			entity.markAsFailed({
				errorCode: 'INSTALLMENT_CONCURRENT_MODIFICATION',
				retryable: true,
				errorMessage: 'race',
			});
			entity.prepareForRetry();
			expect(entity.status).toBe(EPaymentWebhookStatus.Received);
			expect(entity.errorCode).toBeNull();
			expect(entity.retryable).toBeNull();
			expect(entity.errorMessage).toBeNull();
		});
	});
});
