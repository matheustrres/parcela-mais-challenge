import { MockProxy, mock } from 'vitest-mock-extended';

import { PaymentIdempotencyPayloadHasherService } from '@/modules/payments/application/services/payment-idempotency-payload-hasher.service';

export function makePaymentIdempotencyPayloadHasherServiceMock(): MockProxy<PaymentIdempotencyPayloadHasherService> {
	return mock<PaymentIdempotencyPayloadHasherService>();
}
