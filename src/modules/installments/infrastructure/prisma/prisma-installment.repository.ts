import { Injectable } from '@nestjs/common';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { TransactionContext } from '@/@core/application/transaction-manager';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { EInstallmentStatus } from '@/@core/enums/domain';

import { InstallmentRepository } from '@/modules/installments/application/repositories/installment.repository';
import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';

import { DatabaseService } from '@/shared/modules/database/database.service';
import { resolvePrismaClient } from '@/shared/modules/database/prisma-transaction-manager';
import { version } from 'os';

@Injectable()
export class PrismaInstallmentRepository extends InstallmentRepository {
	constructor(private readonly databaseService: DatabaseService) {
		super();
	}

	async findByIdAndClinicId(
		id: EntityUuid,
		clinicId: EntityUuid,
	): Promise<InstallmentEntity | null> {
		const installment = await this.databaseService.installment.findFirst({
			where: {
				id: id.toString(),
				clinicId: clinicId.toString(),
			},
		});
		if (!installment) return null;
		return InstallmentEntity.createFrom(
			EntityUuid.createFrom(installment.id),
			{
				clinicId: EntityUuid.createFrom(installment.clinicId),
				debtAgreementId: EntityUuid.createFrom(installment.debtAgreementId),
				installmentNumber: installment.installmentNumber,
				dueDate: installment.dueDate,
				amount: MoneyVo.fromCents(installment.amountCents),
				paidAmount: MoneyVo.fromCents(installment.paidAmountCents),
				status: installment.status as EInstallmentStatus,
				paidAt: installment.paidAt,
				version: installment.version,
			},
			{
				createdAt: installment.createdAt,
				updatedAt: installment.updatedAt,
			},
		);
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

	async update(
		installment: InstallmentEntity,
		tx?: TransactionContext,
	): Promise<void> {
		const client = resolvePrismaClient(this.databaseService, tx);
		const result = await client.installment.updateMany({
			where: {
				id: installment.id.toString(),
				clinicId: installment.clinicId.toString(),
				version: installment.version - 1,
			},
			data: {
				paidAmountCents: installment.paidAmount.getCents(),
				status: installment.status,
				paidAt: installment.paidAt,
				version: installment.version,
				updatedAt: installment.updatedAt ?? new Date(),
			},
		});

		if (result.count === 0) {
			throw new ApplicationException('INSTALLMENT_CONCURRENT_MODIFICATION');
		}
	}
}
