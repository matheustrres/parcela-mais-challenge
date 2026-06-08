import { Injectable } from '@nestjs/common';

import { TransactionContext } from '@/@core/application/transaction-manager';

import { InstallmentRepository } from '@/modules/installments/application/repositories/installment.repository';
import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';

import { DatabaseService } from '@/shared/modules/database/database.service';
import { resolvePrismaClient } from '@/shared/modules/database/prisma-transaction-manager';

@Injectable()
export class PrismaInstallmentRepository extends InstallmentRepository {
	constructor(private readonly databaseService: DatabaseService) {
		super();
	}

	async createMany(
		installments: InstallmentEntity[],
		tx?: TransactionContext,
	): Promise<void> {
		if (installments.length === 0) {
			return;
		}

		const client = resolvePrismaClient(this.databaseService, tx);

		await client.installment.createMany({
			data: installments.map((installment) => ({
				id: installment.id.toString(),
				clinicId: installment.clinicId.toString(),
				debtAgreementId: installment.debtAgreementId.toString(),
				installmentNumber: installment.installmentNumber,
				dueDate: installment.dueDate,
				amountCents: installment.amount.getCents(),
				paidAmountCents: installment.paidAmount.getCents(),
				status: installment.status,
				paidAt: installment.paidAt,
				version: installment.version,
				createdAt: installment.createdAt,
				updatedAt: installment.updatedAt ?? installment.createdAt,
			})),
		});
	}
}
