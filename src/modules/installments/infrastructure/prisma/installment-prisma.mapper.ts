import { Installment, Prisma } from '@prisma/client';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { EInstallmentStatus } from '@/@core/enums/domain';

import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';

export class InstallmentPrismaMapper {
	static toDomain(record: Installment): InstallmentEntity {
		return InstallmentEntity.createFrom(
			EntityUuid.createFrom(record.id),
			{
				clinicId: EntityUuid.createFrom(record.clinicId),
				debtAgreementId: EntityUuid.createFrom(record.debtAgreementId),
				installmentNumber: record.installmentNumber,
				dueDate: record.dueDate,
				amount: MoneyVo.fromCents(record.amountCents),
				paidAmount: MoneyVo.fromCents(record.paidAmountCents),
				status: record.status as EInstallmentStatus,
				paidAt: record.paidAt,
				version: record.version,
			},
			{
				createdAt: record.createdAt,
				updatedAt: record.updatedAt,
			},
		);
	}

	static toPersistence(
		entity: InstallmentEntity,
	): Prisma.InstallmentCreateManyInput {
		return {
			id: entity.id.toString(),
			clinicId: entity.clinicId.toString(),
			debtAgreementId: entity.debtAgreementId.toString(),
			installmentNumber: entity.installmentNumber,
			dueDate: entity.dueDate,
			amountCents: entity.amount.getCents(),
			paidAmountCents: entity.paidAmount.getCents(),
			status: entity.status,
			paidAt: entity.paidAt,
			version: entity.version,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt ?? entity.createdAt,
		};
	}

	static toUpdatePersistence(
		entity: InstallmentEntity,
	): Prisma.InstallmentUpdateManyMutationInput {
		return {
			paidAmountCents: entity.paidAmount.getCents(),
			status: entity.status,
			paidAt: entity.paidAt,
			version: entity.version,
			updatedAt: entity.updatedAt ?? new Date(),
		};
	}
}
