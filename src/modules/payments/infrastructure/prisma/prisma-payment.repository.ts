import { Injectable } from '@nestjs/common';

import { TransactionContext } from '@/@core/application/transaction-manager';
import { EntityId } from '@/@core/domain/entities/entity-id';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { EPaymentMethod } from '@/@core/enums/domain';

import { PaymentRepository } from '@/modules/payments/application/repositories/payment.repository';
import { PaymentEntity } from '@/modules/payments/domain/entities/payment.entity';

import { DatabaseService } from '@/shared/modules/database/database.service';
import { resolvePrismaClient } from '@/shared/modules/database/prisma-transaction-manager';

@Injectable()
export class PrismaPaymentRepository extends PaymentRepository {
	constructor(private readonly databaseService: DatabaseService) {
		super();
	}

	async findByClinicIdAndIdempotencyKey(
		clinicId: EntityUuid,
		idempotencyKey: string,
	): Promise<PaymentEntity | null> {
		const payment = await this.databaseService.payment.findUnique({
			where: {
				clinicId_idempotencyKey: {
					clinicId: clinicId.toString(),
					idempotencyKey: idempotencyKey,
				},
			},
		});

		return payment ? this.toEntity(payment) : null;
	}

	async findByClinicIdAndExternalReference(
		clinicId: EntityUuid,
		externalReference: string,
	): Promise<PaymentEntity | null> {
		const payment = await this.databaseService.payment.findUnique({
			where: {
				clinicId_externalReference: {
					clinicId: clinicId.toString(),
					externalReference: externalReference,
				},
			},
		});

		return payment ? this.toEntity(payment) : null;
	}

	async create(payment: PaymentEntity, tx?: TransactionContext): Promise<void> {
		const client = resolvePrismaClient(this.databaseService, tx);

		await client.payment.create({
			data: {
				id: payment.id.toString(),
				clinicId: payment.clinicId.toString(),
				installmentId: payment.installmentId.toString(),
				amountCents: payment.amount.getCents(),
				method: payment.method,
				externalReference: payment.externalReference,
				idempotencyKey: payment.idempotencyKey,
				idempotencyPayloadHash: payment.idempotencyPayloadHash,
				paidAt: payment.paidAt,
				createdAt: payment.createdAt,
			},
		});
	}

	async findByClinicIdAndInstallmentIdsPaidSince(input: {
		clinicId: EntityId;
		installmentIds: EntityId[];
		paidSince: Date;
	}): Promise<PaymentEntity[]> {
		if (input.installmentIds.length === 0) {
			return [];
		}

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

		return payments.map((payment) => this.toEntity(payment));
	}

	async findByClinicIdAndInstallmentIds(
		clinicId: EntityId,
		installmentIds: EntityId[],
	): Promise<PaymentEntity[]> {
		if (!installmentIds.length) {
			return [];
		}

		const payments = await this.databaseService.payment.findMany({
			where: {
				clinicId: clinicId.toString(),
				installmentId: {
					in: installmentIds.map((installmentId) => installmentId.toString()),
				},
			},
		});

		return payments.map((payment) => this.toEntity(payment));
	}

	private toEntity(payment: {
		id: string;
		clinicId: string;
		installmentId: string;
		amountCents: number;
		method: string;
		externalReference: string | null;
		idempotencyKey: string;
		idempotencyPayloadHash: string;
		paidAt: Date;
		createdAt: Date;
	}): PaymentEntity {
		return PaymentEntity.createFrom(
			EntityUuid.createFrom(payment.id),
			{
				clinicId: EntityUuid.createFrom(payment.clinicId),
				installmentId: EntityUuid.createFrom(payment.installmentId),
				amount: MoneyVo.fromCents(payment.amountCents),
				method: payment.method as EPaymentMethod,
				externalReference: payment.externalReference,
				idempotencyKey: payment.idempotencyKey,
				idempotencyPayloadHash: payment.idempotencyPayloadHash,
				paidAt: payment.paidAt,
			},
			{
				createdAt: payment.createdAt,
			},
		);
	}
}
