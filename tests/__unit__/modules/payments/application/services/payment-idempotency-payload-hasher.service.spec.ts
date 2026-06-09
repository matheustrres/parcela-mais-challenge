import { describe, expect, it } from 'vitest';

import { EPaymentMethod } from '@/@core/enums/domain';

import { PaymentIdempotencyPayloadHasherService } from '@/modules/payments/application/services/payment-idempotency-payload-hasher.service';

describe('PaymentIdempotencyPayloadHasherService', () => {
	const service = new PaymentIdempotencyPayloadHasherService();

	it('should generate same hash for same normalized payload', () => {
		const paidAt = new Date('2026-01-12T15:30:00.000Z');

		const hashA = service.hash({
			clinicId: 'clinic-1',
			installmentId: 'installment-1',
			amountCents: 500,
			method: EPaymentMethod.Pix,
			externalReference: null,
			paidAt,
		});
		const hashB = service.hash({
			clinicId: 'clinic-1',
			installmentId: 'installment-1',
			amountCents: 500,
			method: EPaymentMethod.Pix,
			externalReference: null,
			paidAt,
		});

		expect(hashA).toBe(hashB);
	});

	it('should treat null and undefined-style external reference as same normalized value', () => {
		const paidAt = new Date('2026-01-12T15:30:00.000Z');

		const hashA = service.hash({
			clinicId: 'clinic-1',
			installmentId: 'installment-1',
			amountCents: 500,
			method: EPaymentMethod.Pix,
			externalReference: null,
			paidAt,
		});
		const hashB = service.hash({
			clinicId: 'clinic-1',
			installmentId: 'installment-1',
			amountCents: 500,
			method: EPaymentMethod.Pix,
			externalReference: null,
			paidAt,
		});

		expect(hashA).toBe(hashB);
	});

	it('should change hash when relevant payload changes', () => {
		const paidAt = new Date('2026-01-12T15:30:00.000Z');

		const baseline = service.hash({
			clinicId: 'clinic-1',
			installmentId: 'installment-1',
			amountCents: 500,
			method: EPaymentMethod.Pix,
			externalReference: 'ext-1',
			paidAt,
		});

		expect(
			service.hash({
				clinicId: 'clinic-1',
				installmentId: 'installment-2',
				amountCents: 500,
				method: EPaymentMethod.Pix,
				externalReference: 'ext-1',
				paidAt,
			}),
		).not.toBe(baseline);
		expect(
			service.hash({
				clinicId: 'clinic-1',
				installmentId: 'installment-1',
				amountCents: 700,
				method: EPaymentMethod.Pix,
				externalReference: 'ext-1',
				paidAt,
			}),
		).not.toBe(baseline);
		expect(
			service.hash({
				clinicId: 'clinic-1',
				installmentId: 'installment-1',
				amountCents: 500,
				method: EPaymentMethod.Manual,
				externalReference: 'ext-1',
				paidAt,
			}),
		).not.toBe(baseline);
		expect(
			service.hash({
				clinicId: 'clinic-1',
				installmentId: 'installment-1',
				amountCents: 500,
				method: EPaymentMethod.Pix,
				externalReference: 'ext-2',
				paidAt,
			}),
		).not.toBe(baseline);
		expect(
			service.hash({
				clinicId: 'clinic-1',
				installmentId: 'installment-1',
				amountCents: 500,
				method: EPaymentMethod.Pix,
				externalReference: 'ext-1',
				paidAt: new Date('2026-01-13T15:30:00.000Z'),
			}),
		).not.toBe(baseline);
	});
});
