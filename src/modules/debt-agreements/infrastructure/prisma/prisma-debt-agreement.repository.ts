import { Injectable } from '@nestjs/common';

import { TransactionContext } from '@/@core/application/transaction-manager';
import { EntityId } from '@/@core/domain/entities/entity-id';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { EDebtAgreementStatus } from '@/@core/enums/domain';

import { DebtAgreementRepository } from '@/modules/debt-agreements/application/repositories/debt-agreement.repository';
import { DebtAgreementEntity } from '@/modules/debt-agreements/domain/entities/debt-agreement.entity';

import { DatabaseService } from '@/shared/modules/database/database.service';
import { resolvePrismaClient } from '@/shared/modules/database/prisma-transaction-manager';

@Injectable()
export class PrismaDebtAgreementRepository extends DebtAgreementRepository {
	constructor(private readonly databaseService: DatabaseService) {
		super();
	}

	async findById(id: EntityId): Promise<DebtAgreementEntity | null> {
		const debtAgreement = await this.databaseService.debtAgreement.findUnique({
			where: {
				id: id.toString(),
			},
		});
		if (!debtAgreement) return null;
		return DebtAgreementEntity.createFrom(
			EntityUuid.createFrom(debtAgreement.id),
			{
				clinicId: EntityUuid.createFrom(debtAgreement.clinicId),
				patientId: EntityUuid.createFrom(debtAgreement.patientId),
				totalAmount: MoneyVo.fromCents(debtAgreement.totalAmountCents),
				installmentsCount: debtAgreement.installmentsCount,
				status: debtAgreement.status as EDebtAgreementStatus,
			},
			{
				createdAt: debtAgreement.createdAt,
				updatedAt: debtAgreement.updatedAt,
			},
		);
	}

	async create(
		debtAgreement: DebtAgreementEntity,
		tx?: TransactionContext,
	): Promise<void> {
		const client = resolvePrismaClient(this.databaseService, tx);
		await client.debtAgreement.create({
			data: {
				id: debtAgreement.id.toString(),
				clinicId: debtAgreement.clinicId.toString(),
				patientId: debtAgreement.patientId.toString(),
				totalAmountCents: debtAgreement.totalAmount.getCents(),
				installmentsCount: debtAgreement.installmentsCount,
				status: debtAgreement.status,
				createdAt: debtAgreement.createdAt,
				updatedAt: debtAgreement.updatedAt ?? debtAgreement.createdAt,
			},
		});
	}
}
