import { MockProxy, mock } from 'vitest-mock-extended';

import { PaymentWebhookEventRepository } from '@/modules/payment-webhook-events/application/repositories/payment-webhook-event.repository';

export function makePaymentWebhookEventRepositoryMock(): MockProxy<PaymentWebhookEventRepository> {
	return mock<PaymentWebhookEventRepository>();
}
