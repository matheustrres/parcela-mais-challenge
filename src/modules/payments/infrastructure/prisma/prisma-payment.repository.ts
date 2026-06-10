import { Injectable } from '@nestjs/common';

import { TransactionContext } from '@/@core/application/transaction-manager';
import { EntityId } from '@/@core/domain/entities/entity-id';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';

import { PaymentRepository } from '@/modules/payments/application/repositories/payment.repository';
import { PaymentEntity } from '@/modules/payments/domain/entities/payment.entity';
import { PaymentPrismaMapper } from '@/modules/payments/infrastructure/prisma/payment-prisma.mapper';

import { DatabaseService } from '@/shared/modules/database/database.service';
import { resolvePrismaClient } from '@/shared/modules/database/prisma-transaction-manager';

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
	constructor(private readonly databaseService: DatabaseService) {}

	async findByIdAndClinicId(
		id: EntityUuid,
		clinicId: EntityUuid,
	): Promise<PaymentEntity | null> {
		const payment = await this.databaseService.payment.findFirst({
			where: {
				id: id.toString(),
				clinicId: clinicId.toString(),
			},
		});
		return payment ? PaymentPrismaMapper.toDomain(payment) : null;
	}

	async findByClinicIdAndIdempotencyKey(
		clinicId: EntityUuid,
		idempotencyKey: string,
	): Promise<PaymentEntity | null> {
		const payment = await this.databaseService.payment.findUnique({
			where: {
				clinicId_idempotencyKey: {
					clinicId: clinicId.toString(),
					idempotencyKey,
				},
			},
		});
		return payment ? PaymentPrismaMapper.toDomain(payment) : null;
	}

	async findByClinicIdAndExternalReference(
		clinicId: EntityUuid,
		externalReference: string,
	): Promise<PaymentEntity | null> {
		const payment = await this.databaseService.payment.findUnique({
			where: {
				clinicId_externalReference: {
					clinicId: clinicId.toString(),
					externalReference,
				},
			},
		});
		return payment ? PaymentPrismaMapper.toDomain(payment) : null;
	}

	async create(payment: PaymentEntity, tx?: TransactionContext): Promise<void> {
		const client = resolvePrismaClient(this.databaseService, tx);
		await client.payment.create({
			data: PaymentPrismaMapper.toPersistence(payment),
		});
	}

	async findByClinicIdAndInstallmentIdsPaidSince(input: {
		clinicId: EntityId;
		installmentIds: EntityId[];
		paidSince: Date;
	}): Promise<PaymentEntity[]> {
		if (!input.installmentIds.length) return [];
		const payments = await this.databaseService.payment.findMany({
			where: {
				clinicId: input.clinicId.toString(),
				installmentId: {
					in: input.installmentIds.map((installmentId) =>
						installmentId.toString(),
					),
				},
				paidAt: {
					gte: input.paidSince,
				},
			},
		});
		return payments.map(PaymentPrismaMapper.toDomain);
	}

	async findByClinicIdAndInstallmentIds(
		clinicId: EntityId,
		installmentIds: EntityId[],
	): Promise<PaymentEntity[]> {
		if (!installmentIds.length) return [];
		const payments = await this.databaseService.payment.findMany({
			where: {
				clinicId: clinicId.toString(),
				installmentId: {
					in: installmentIds.map((installmentId) => installmentId.toString()),
				},
			},
		});
		return payments.map(PaymentPrismaMapper.toDomain);
	}
}
