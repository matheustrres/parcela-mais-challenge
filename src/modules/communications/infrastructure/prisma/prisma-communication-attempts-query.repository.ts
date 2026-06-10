import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { EntityId } from '@/@core/domain/entities/entity-id';

import {
	CommunicationAttemptListItem,
	CommunicationAttemptsQueryRepository,
	PaginatedCommunicationAttempts,
} from '@/modules/communications/application/repositories/communication-attempts-query.repository';

import { DatabaseService } from '@/shared/modules/database/database.service';

type CommunicationAttemptListRecord = Prisma.CommunicationAttemptGetPayload<{
	include: {
		patient: true;
		installment: true;
	};
}>;

@Injectable()
export class PrismaCommunicationAttemptsQueryRepository implements CommunicationAttemptsQueryRepository {
	constructor(private readonly databaseService: DatabaseService) {}

	async findByClinicId(input: {
		clinicId: EntityId;
		limit: number;
		offset: number;
	}): Promise<PaginatedCommunicationAttempts> {
		const [total, attempts] = await Promise.all([
			this.databaseService.communicationAttempt.count({
				where: {
					clinicId: input.clinicId.toString(),
				},
			}),
			this.databaseService.communicationAttempt.findMany({
				where: {
					clinicId: input.clinicId.toString(),
				},
				include: {
					patient: true,
					installment: true,
				},
				orderBy: [{ createdAt: 'desc' }],
				take: input.limit,
				skip: input.offset,
			}),
		]);

		return {
			total,
			items: attempts.map((record) => this.toItem(record)),
		};
	}

	private toItem(
		record: CommunicationAttemptListRecord,
	): CommunicationAttemptListItem {
		return {
			id: record.id,
			patientId: record.patientId,
			installmentId: record.installmentId,
			type: record.type as CommunicationAttemptListItem['type'],
			channel: record.channel as CommunicationAttemptListItem['channel'],
			status: record.status as CommunicationAttemptListItem['status'],
			scheduledFor: record.scheduledFor,
			sentAt: record.sentAt,
			skippedReason: record.skippedReason,
			templateKey: record.templateKey,
			aiGenerated: record.aiGenerated,
			message: record.message,
			createdAt: record.createdAt,
			patient: {
				id: record.patient.id,
				name: record.patient.name,
			},
			installment: {
				id: record.installment.id,
				installmentNumber: record.installment.installmentNumber,
				dueDate: record.installment.dueDate,
				status: record.installment
					.status as CommunicationAttemptListItem['installment']['status'],
			},
		};
	}
}
