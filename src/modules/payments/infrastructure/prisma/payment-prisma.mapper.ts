import { Payment, Prisma } from '@prisma/client';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { EPaymentMethod } from '@/@core/enums/domain';

import { PaymentEntity } from '@/modules/payments/domain/entities/payment.entity';

export class PaymentPrismaMapper {
	static toDomain(record: Payment): PaymentEntity {
		return PaymentEntity.createFrom(
			EntityUuid.createFrom(record.id),
			{
				clinicId: EntityUuid.createFrom(record.clinicId),
				installmentId: EntityUuid.createFrom(record.installmentId),
				amount: MoneyVo.fromCents(record.amountCents),
				method: record.method as EPaymentMethod,
				externalReference: record.externalReference,
				idempotencyKey: record.idempotencyKey,
				idempotencyPayloadHash: record.idempotencyPayloadHash,
				paidAt: record.paidAt,
			},
			{
				createdAt: record.createdAt,
			},
		);
	}

	static toPersistence(
		entity: PaymentEntity,
	): Prisma.PaymentUncheckedCreateInput {
		return {
			id: entity.id.toString(),
			clinicId: entity.clinicId.toString(),
			installmentId: entity.installmentId.toString(),
			amountCents: entity.amount.getCents(),
			method: entity.method,
			externalReference: entity.externalReference,
			idempotencyKey: entity.idempotencyKey,
			idempotencyPayloadHash: entity.idempotencyPayloadHash,
			paidAt: entity.paidAt,
			createdAt: entity.createdAt,
		};
	}
}
