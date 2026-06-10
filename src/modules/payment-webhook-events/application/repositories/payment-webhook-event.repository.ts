import { TransactionContext } from '@/@core/application/transaction-manager';

import { PaymentWebhookEventEntity } from '@/modules/payment-webhook-events/domain/entities/payment-webhook-event.entity';

export abstract class PaymentWebhookEventRepository {
	abstract findByProviderAndEventId(
		provider: string,
		eventId: string,
	): Promise<PaymentWebhookEventEntity | null>;
	abstract create(
		event: PaymentWebhookEventEntity,
		tx?: TransactionContext,
	): Promise<void>;
	abstract update(
		event: PaymentWebhookEventEntity,
		tx?: TransactionContext,
	): Promise<void>;
}
