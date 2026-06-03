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
		status: EPaymentWebhookStatus.Received,
		processedAt: null,
		errorMessage: null,
	});

	describe('.create', () => {
		it('should create webhook event with normalized strings', () => {
			const entity = PaymentWebhookEventEntity.create(makeProps());
			expect(entity.id).toBeInstanceOf(EntityUuid);
			expect(entity.provider).toBe('provider');
			expect(entity.eventId).toBe('event-id');
			expect(entity.externalReference).toBe('ext-ref');
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
					'PROCESSED_PAYMENT_WEBHOOK_REQUIRES_PAYMENT_ID_AND_PROCESSED_AT',
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
			const processedAt = new Date('2024-07-02T09:00:00.000Z');
			entity.markAsProcessed(paymentId, processedAt);
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
			entity.markAsFailed('  invalid signature  ');
			expect(entity.status).toBe(EPaymentWebhookStatus.Failed);
			expect(entity.errorMessage).toBe('invalid signature');
			expect(entity.updatedAt).toEqual(new Date('2024-07-04T10:00:00.000Z'));
			vi.useRealTimers();
		});

		it('should reject empty error message', () => {
			const entity = PaymentWebhookEventEntity.create(makeProps());
			expect(() => entity.markAsFailed(' ')).toThrowError(
				new DomainException('PAYMENT_WEBHOOK_ERROR_MESSAGE_REQUIRED'),
			);
		});
	});
});
