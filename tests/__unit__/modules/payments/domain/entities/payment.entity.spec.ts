import { describe, expect, it } from 'vitest';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { DomainException } from '@/@core/domain/exceptions/domain-exception';
import { EPaymentMethod } from '@/@core/enums/domain';

import { PaymentEntity } from '@/modules/payments/domain/entities/payment.entity';

describe('PaymentEntity', () => {
	const makeProps = () => ({
		clinicId: EntityUuid.createFrom('clinic-id'),
		installmentId: EntityUuid.createFrom('installment-id'),
		amount: MoneyVo.fromCents(5_000),
		method: EPaymentMethod.Pix,
		externalReference: ' external-ref ',
		idempotencyKey: ' idem-key ',
		idempotencyPayloadHash: ' hash ',
		paidAt: new Date('2024-05-01T10:00:00.000Z'),
	});

	describe('.create', () => {
		it('should create payment with normalized fields and generated id', () => {
			const entity = PaymentEntity.create(makeProps());
			expect(entity.id).toBeInstanceOf(EntityUuid);
			expect(entity.externalReference).toBe('external-ref');
			expect(entity.idempotencyKey).toBe('idem-key');
			expect(entity.idempotencyPayloadHash).toBe('hash');
			expect(entity.updatedAt).toBeNull();
		});

		it('should reject non-positive amount', () => {
			expect(() =>
				PaymentEntity.create({
					...makeProps(),
					amount: MoneyVo.zero(),
				}),
			).toThrowError(new DomainException('PAYMENT_AMOUNT_MUST_BE_POSITIVE'));
		});

		it('should reject empty idempotency key', () => {
			expect(() =>
				PaymentEntity.create({
					...makeProps(),
					idempotencyKey: ' ',
				}),
			).toThrowError(new DomainException('PAYMENT_IDEMPOTENCY_KEY_REQUIRED'));
		});

		it('should reject empty payload hash', () => {
			expect(() =>
				PaymentEntity.create({
					...makeProps(),
					idempotencyPayloadHash: ' ',
				}),
			).toThrowError(
				new DomainException('PAYMENT_IDEMPOTENCY_PAYLOAD_HASH_REQUIRED'),
			);
		});
	});

	describe('.createFrom', () => {
		it('should create payment with provided id and meta', () => {
			const id = EntityUuid.createFrom('payment-id');
			const createdAt = new Date('2024-05-02T10:00:00.000Z');
			const entity = PaymentEntity.createFrom(id, makeProps(), { createdAt });
			expect(entity.id.toString()).toBe('payment-id');
			expect(entity.createdAt).toBe(createdAt);
		});
	});

	describe('.isFromWebhook', () => {
		it('should return true when payment method is webhook simulated', () => {
			expect(
				PaymentEntity.create({
					...makeProps(),
					method: EPaymentMethod.WebhookSimulated,
				}).isFromWebhook(),
			).toBe(true);
		});
	});

	describe('.hasExternalReference', () => {
		it('should return true when external reference exists', () => {
			expect(PaymentEntity.create(makeProps()).hasExternalReference()).toBe(
				true,
			);
		});

		it('should return false when external reference is null', () => {
			expect(
				PaymentEntity.create({
					...makeProps(),
					externalReference: null,
				}).hasExternalReference(),
			).toBe(false);
		});
	});
});
