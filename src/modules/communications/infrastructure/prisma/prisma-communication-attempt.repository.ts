import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { TransactionContext } from '@/@core/application/transaction-manager';
import { EntityId } from '@/@core/domain/entities/entity-id';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import {
	ECommunicationChannel,
	ECommunicationStatus,
	ECommunicationType,
} from '@/@core/enums/domain';

import { CommunicationAttemptRepository } from '@/modules/communications/application/repositories/communication-attempt.repository';
import { CommunicationAttemptEntity } from '@/modules/communications/domain/entities/communication-attempt.entity';

import { DatabaseService } from '@/shared/modules/database/database.service';
import { resolvePrismaClient } from '@/shared/modules/database/prisma-transaction-manager';

@Injectable()
export class PrismaCommunicationAttemptRepository extends CommunicationAttemptRepository {
	constructor(private readonly databaseService: DatabaseService) {
		super();
	}

	async findRelevantForCollectionRun(input: {
		clinicId: EntityId;
		installmentIds: EntityId[];
		patientIds: EntityId[];
	}): Promise<CommunicationAttemptEntity[]> {
		if (input.installmentIds.length === 0 || input.patientIds.length === 0) {
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

		return attempts.map((attempt) =>
			CommunicationAttemptEntity.createFrom(
				EntityUuid.createFrom(attempt.id),
				{
					clinicId: EntityUuid.createFrom(attempt.clinicId),
					patientId: EntityUuid.createFrom(attempt.patientId),
					installmentId: EntityUuid.createFrom(attempt.installmentId),
					type: attempt.type as ECommunicationType,
					channel: attempt.channel as ECommunicationChannel,
					status: attempt.status as ECommunicationStatus,
					scheduledFor: attempt.scheduledFor,
					sentAt: attempt.sentAt,
					skippedReason: attempt.skippedReason,
					message: attempt.message,
					aiGenerated: attempt.aiGenerated,
					templateKey: attempt.templateKey,
				},
				{
					createdAt: attempt.createdAt,
					updatedAt: attempt.updatedAt,
				},
			),
		);
	}

	async createMany(
		attempts: CommunicationAttemptEntity[],
		tx?: TransactionContext,
	): Promise<void> {
		if (attempts.length === 0) {
			return;
		}

		const client = resolvePrismaClient(this.databaseService, tx);

		try {
			await client.communicationAttempt.createMany({
				data: attempts.map((attempt) => ({
					id: attempt.id.toString(),
					clinicId: attempt.clinicId.toString(),
					patientId: attempt.patientId.toString(),
					installmentId: attempt.installmentId.toString(),
					type: attempt.type,
					channel: attempt.channel,
					status: attempt.status,
					scheduledFor: attempt.scheduledFor,
					sentAt: attempt.sentAt,
					skippedReason: attempt.skippedReason,
					message: attempt.message,
					aiGenerated: attempt.aiGenerated,
					templateKey: attempt.templateKey,
					createdAt: attempt.createdAt,
					updatedAt: attempt.updatedAt ?? attempt.createdAt,
				})),
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
