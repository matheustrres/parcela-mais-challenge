import { describe, expect, it } from 'vitest';

import { EPaymentMethod } from '@/@core/enums/domain';

import { SimulatedPaymentWebhookPayloadService } from '@/modules/payments/application/services/simulated-payment-webhook-payload.service';

describe('SimulatedPaymentWebhookPayloadService', () => {
	const service = new SimulatedPaymentWebhookPayloadService();

	it('should normalize payload and build deterministic idempotency key', () => {
		const normalized = service.normalize({
			provider: ' pix_simulator ',
			eventId: ' evt-1 ',
			clinicId: 'clinic-1',
			installmentId: 'installment-1',
			externalReference: ' ext-1 ',
			amountCents: 500,
			method: EPaymentMethod.Pix,
			paidAt: new Date('2026-06-10T13:00:00.000Z'),
		});

		expect(normalized).toMatchObject({
			provider: 'PIX_SIMULATOR',
			eventId: 'evt-1',
			externalReference: 'ext-1',
			paidAt: '2026-06-10T13:00:00.000Z',
		});
		expect(service.buildIdempotencyKey(normalized)).toBe(
			'webhook:PIX_SIMULATOR:evt-1',
		);
	});
});
