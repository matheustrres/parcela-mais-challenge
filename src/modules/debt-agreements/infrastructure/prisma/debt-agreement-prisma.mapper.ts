import { DebtAgreement, Prisma } from '@prisma/client';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { EDebtAgreementStatus } from '@/@core/enums/domain';

import { DebtAgreementEntity } from '@/modules/debt-agreements/domain/entities/debt-agreement.entity';

export class DebtAgreementPrismaMapper {
	static toDomain(record: DebtAgreement): DebtAgreementEntity {
		return DebtAgreementEntity.createFrom(
			EntityUuid.createFrom(record.id),
			{
				clinicId: EntityUuid.createFrom(record.clinicId),
				patientId: EntityUuid.createFrom(record.patientId),
				totalAmount: MoneyVo.fromCents(record.totalAmountCents),
				installmentsCount: record.installmentsCount,
				status: record.status as EDebtAgreementStatus,
			},
			{
				createdAt: record.createdAt,
				updatedAt: record.updatedAt,
			},
		);
	}

	static toPersistence(
		entity: DebtAgreementEntity,
	): Prisma.DebtAgreementUncheckedCreateInput {
		return {
			id: entity.id.toString(),
			clinicId: entity.clinicId.toString(),
			patientId: entity.patientId.toString(),
			totalAmountCents: entity.totalAmount.getCents(),
			installmentsCount: entity.installmentsCount,
			status: entity.status,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt ?? entity.createdAt,
		};
	}
}
