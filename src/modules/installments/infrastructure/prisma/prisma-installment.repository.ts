import { Injectable } from '@nestjs/common';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { TransactionContext } from '@/@core/application/transaction-manager';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';

import { InstallmentRepository } from '@/modules/installments/application/repositories/installment.repository';
import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { InstallmentPrismaMapper } from '@/modules/installments/infrastructure/prisma/installment-prisma.mapper';

import { DatabaseService } from '@/shared/modules/database/database.service';
import { resolvePrismaClient } from '@/shared/modules/database/prisma-transaction-manager';

@Injectable()
export class PrismaInstallmentRepository implements InstallmentRepository {
	constructor(private readonly databaseService: DatabaseService) {}

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
		return InstallmentPrismaMapper.toDomain(installment);
	}

	async createMany(
		installments: InstallmentEntity[],
		tx?: TransactionContext,
	): Promise<void> {
		if (!installments.length) return;
		const client = resolvePrismaClient(this.databaseService, tx);
		await client.installment.createMany({
			data: installments.map((installment) =>
				InstallmentPrismaMapper.toPersistence(installment),
			),
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
			data: InstallmentPrismaMapper.toUpdatePersistence(installment),
		});
		if (result.count === 0) {
			throw new ApplicationException('INSTALLMENT_CONCURRENT_MODIFICATION');
		}
	}
}
