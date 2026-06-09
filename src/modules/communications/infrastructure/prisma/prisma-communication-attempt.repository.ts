import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { TransactionContext } from '@/@core/application/transaction-manager';
import { EntityId } from '@/@core/domain/entities/entity-id';

import { CommunicationAttemptRepository } from '@/modules/communications/application/repositories/communication-attempt.repository';
import { CommunicationAttemptEntity } from '@/modules/communications/domain/entities/communication-attempt.entity';
import { CommunicationAttemptPrismaMapper } from '@/modules/communications/infrastructure/prisma/communication-attempt-prisma.mapper';

import { DatabaseService } from '@/shared/modules/database/database.service';
import { resolvePrismaClient } from '@/shared/modules/database/prisma-transaction-manager';

@Injectable()
export class PrismaCommunicationAttemptRepository implements CommunicationAttemptRepository {
	constructor(private readonly databaseService: DatabaseService) {}

	async findRelevantForCollectionRun(input: {
		clinicId: EntityId;
		installmentIds: EntityId[];
		patientIds: EntityId[];
	}): Promise<CommunicationAttemptEntity[]> {
		if (!input.installmentIds.length || !input.patientIds.length) {
			return [];
		}
		const attempts = await this.databaseService.communicationAttempt.findMany({
			where: {
				clinicId: input.clinicId.toString(),
				OR: [
					{
						installmentId: {
							in: input.installmentIds.map((installmentId) =>
								installmentId.toString(),
							),
						},
					},
					{
						patientId: {
							in: input.patientIds.map((patientId) => patientId.toString()),
						},
					},
				],
			},
		});
		return attempts.map(CommunicationAttemptPrismaMapper.toDomain);
	}

	async findByClinicIdAndInstallmentIds(
		clinicId: EntityId,
		installmentIds: EntityId[],
	): Promise<CommunicationAttemptEntity[]> {
		if (!installmentIds.length) {
			return [];
		}
		const attempts = await this.databaseService.communicationAttempt.findMany({
			where: {
				clinicId: clinicId.toString(),
				installmentId: {
					in: installmentIds.map((installmentId) => installmentId.toString()),
				},
			},
		});
		return attempts.map(CommunicationAttemptPrismaMapper.toDomain);
	}

	async createMany(
		attempts: CommunicationAttemptEntity[],
		tx?: TransactionContext,
	): Promise<void> {
		if (!attempts.length) return;
		const client = resolvePrismaClient(this.databaseService, tx);
		try {
			await client.communicationAttempt.createMany({
				data: attempts.map((attempt) =>
					CommunicationAttemptPrismaMapper.toPersistence(attempt),
				),
			});
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002'
			) {
				throw new ApplicationException(
					'COLLECTION_RULE_ATTEMPT_ALREADY_EXISTS',
				);
			}
			throw error;
		}
	}
}
