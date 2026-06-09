import { CommunicationAttempt, Prisma } from '@prisma/client';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import {
	ECommunicationChannel,
	ECommunicationStatus,
	ECommunicationType,
} from '@/@core/enums/domain';

import { CommunicationAttemptEntity } from '@/modules/communications/domain/entities/communication-attempt.entity';

export class CommunicationAttemptPrismaMapper {
	static toDomain(record: CommunicationAttempt): CommunicationAttemptEntity {
		return CommunicationAttemptEntity.createFrom(
			EntityUuid.createFrom(record.id),
			{
				clinicId: EntityUuid.createFrom(record.clinicId),
				patientId: EntityUuid.createFrom(record.patientId),
				installmentId: EntityUuid.createFrom(record.installmentId),
				type: record.type as ECommunicationType,
				channel: record.channel as ECommunicationChannel,
				status: record.status as ECommunicationStatus,
				scheduledFor: record.scheduledFor,
				sentAt: record.sentAt,
				skippedReason: record.skippedReason,
				message: record.message,
				aiGenerated: record.aiGenerated,
				templateKey: record.templateKey,
			},
			{
				createdAt: record.createdAt,
				updatedAt: record.updatedAt,
			},
		);
	}

	static toPersistence(
		entity: CommunicationAttemptEntity,
	): Prisma.CommunicationAttemptCreateManyInput {
		return {
			id: entity.id.toString(),
			clinicId: entity.clinicId.toString(),
			patientId: entity.patientId.toString(),
			installmentId: entity.installmentId.toString(),
			type: entity.type,
			channel: entity.channel,
			status: entity.status,
			scheduledFor: entity.scheduledFor,
			sentAt: entity.sentAt,
			skippedReason: entity.skippedReason,
			message: entity.message,
			aiGenerated: entity.aiGenerated,
			templateKey: entity.templateKey,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt ?? entity.createdAt,
		};
	}
}
