import { MockProxy, mock } from 'vitest-mock-extended';

import { PaymentRepository } from '@/modules/payments/application/repositories/payment.repository';

export function makePaymentRepositoryMock(): MockProxy<PaymentRepository> {
	return mock<PaymentRepository>();
}
