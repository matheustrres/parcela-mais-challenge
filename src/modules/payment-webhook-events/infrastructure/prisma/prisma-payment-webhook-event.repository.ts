import { Injectable } from '@nestjs/common';

import { TransactionContext } from '@/@core/application/transaction-manager';

import { PaymentWebhookEventRepository } from '@/modules/payment-webhook-events/application/repositories/payment-webhook-event.repository';
import { PaymentWebhookEventEntity } from '@/modules/payment-webhook-events/domain/entities/payment-webhook-event.entity';
import { PaymentWebhookEventPrismaMapper } from '@/modules/payment-webhook-events/infrastructure/prisma/payment-webhook-event-prisma.mapper';

import { DatabaseService } from '@/shared/modules/database/database.service';
import { resolvePrismaClient } from '@/shared/modules/database/prisma-transaction-manager';

@Injectable()
export class PrismaPaymentWebhookEventRepository implements PaymentWebhookEventRepository {
	constructor(private readonly databaseService: DatabaseService) {}

	async findByProviderAndEventId(
		provider: string,
		eventId: string,
	): Promise<PaymentWebhookEventEntity | null> {
		const event = await this.databaseService.paymentWebhookEvent.findUnique({
			where: {
				provider_eventId: {
					provider,
					eventId,
				},
			},
		});
		return event ? PaymentWebhookEventPrismaMapper.toDomain(event) : null;
	}

	async create(
		event: PaymentWebhookEventEntity,
		tx?: TransactionContext,
	): Promise<void> {
		const client = resolvePrismaClient(this.databaseService, tx);
		await client.paymentWebhookEvent.create({
			data: PaymentWebhookEventPrismaMapper.toPersistence(event),
		});
	}

	async update(
		event: PaymentWebhookEventEntity,
		tx?: TransactionContext,
	): Promise<void> {
		const client = resolvePrismaClient(this.databaseService, tx);
		await client.paymentWebhookEvent.update({
			where: { id: event.id.toString() },
			data: PaymentWebhookEventPrismaMapper.toUpdatePersistence(event),
		});
	}
}
