import { PaymentWebhookEvent, Prisma } from '@prisma/client';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { EPaymentWebhookStatus } from '@/@core/enums/domain';

import { PaymentWebhookEventEntity } from '@/modules/payment-webhook-events/domain/entities/payment-webhook-event.entity';

export class PaymentWebhookEventPrismaMapper {
	static toDomain(record: PaymentWebhookEvent): PaymentWebhookEventEntity {
		return PaymentWebhookEventEntity.createFrom(
			EntityUuid.createFrom(record.id),
			{
				clinicId: EntityUuid.createFrom(record.clinicId),
				installmentId: record.installmentId
					? EntityUuid.createFrom(record.installmentId)
					: null,
				paymentId: record.paymentId
					? EntityUuid.createFrom(record.paymentId)
					: null,
				provider: record.provider,
				eventId: record.eventId,
				externalReference: record.externalReference,
				payload: record.payload as Record<string, unknown>,
				payloadHash: record.payloadHash,
				status: record.status as EPaymentWebhookStatus,
				processedAt: record.processedAt,
				errorCode: record.errorCode,
				retryable: record.retryable,
				errorMessage: record.errorMessage,
			},
			{
				createdAt: record.createdAt,
				updatedAt: record.updatedAt,
			},
		);
	}

	static toPersistence(
		entity: PaymentWebhookEventEntity,
	): Prisma.PaymentWebhookEventUncheckedCreateInput {
		return {
			id: entity.id.toString(),
			clinicId: entity.clinicId.toString(),
			installmentId: entity.installmentId?.toString() ?? null,
			paymentId: entity.paymentId?.toString() ?? null,
			provider: entity.provider,
			eventId: entity.eventId,
			externalReference: entity.externalReference,
			payload: entity.payload as Prisma.InputJsonValue,
			payloadHash: entity.payloadHash,
			status: entity.status,
			processedAt: entity.processedAt,
			errorCode: entity.errorCode,
			retryable: entity.retryable,
			errorMessage: entity.errorMessage,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt ?? entity.createdAt,
		};
	}

	static toUpdatePersistence(
		entity: PaymentWebhookEventEntity,
	): Prisma.PaymentWebhookEventUncheckedUpdateInput {
		return {
			installmentId: entity.installmentId?.toString() ?? null,
			paymentId: entity.paymentId?.toString() ?? null,
			externalReference: entity.externalReference,
			payload: entity.payload as Prisma.InputJsonValue,
			payloadHash: entity.payloadHash,
			status: entity.status,
			processedAt: entity.processedAt,
			errorCode: entity.errorCode,
			retryable: entity.retryable,
			errorMessage: entity.errorMessage,
			updatedAt: entity.updatedAt ?? new Date(),
		};
	}
}
