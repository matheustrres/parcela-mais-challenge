import { Injectable } from '@nestjs/common';

import { TransactionContext } from '@/@core/application/transaction-manager';
import { EntityId } from '@/@core/domain/entities/entity-id';

import { DebtAgreementRepository } from '@/modules/debt-agreements/application/repositories/debt-agreement.repository';
import { DebtAgreementEntity } from '@/modules/debt-agreements/domain/entities/debt-agreement.entity';
import { DebtAgreementPrismaMapper } from '@/modules/debt-agreements/infrastructure/prisma/debt-agreement-prisma.mapper';

import { DatabaseService } from '@/shared/modules/database/database.service';
import { resolvePrismaClient } from '@/shared/modules/database/prisma-transaction-manager';

@Injectable()
export class PrismaDebtAgreementRepository implements DebtAgreementRepository {
	constructor(private readonly databaseService: DatabaseService) {}

	async findById(id: EntityId): Promise<DebtAgreementEntity | null> {
		const debtAgreement = await this.databaseService.debtAgreement.findUnique({
			where: {
				id: id.toString(),
			},
		});
		if (!debtAgreement) return null;
		return DebtAgreementPrismaMapper.toDomain(debtAgreement);
	}

	async create(
		debtAgreement: DebtAgreementEntity,
		tx?: TransactionContext,
	): Promise<void> {
		const client = resolvePrismaClient(this.databaseService, tx);
		await client.debtAgreement.create({
			data: DebtAgreementPrismaMapper.toPersistence(debtAgreement),
		});
	}
}
