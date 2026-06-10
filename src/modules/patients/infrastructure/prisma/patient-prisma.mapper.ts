import { Patient, Prisma } from '@prisma/client';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { ECommunicationChannel, EContactStatus } from '@/@core/enums/domain';

import { PatientEntity } from '@/modules/patients/domain/entities/patient.entity';

export class PatientPrismaMapper {
	static toDomain(record: Patient): PatientEntity {
		return PatientEntity.createFrom(
			EntityUuid.createFrom(record.id),
			{
				name: record.name,
				clinicId: EntityUuid.createFrom(record.clinicId),
				email: record.email,
				phone: record.phone,
				preferredChannel:
					record.preferredChannel as ECommunicationChannel | null,
				contactStatus: record.contactStatus as EContactStatus,
			},
			{
				createdAt: record.createdAt,
				updatedAt: record.updatedAt,
			},
		);
	}

	static toPersistence(
		entity: PatientEntity,
	): Prisma.PatientUncheckedCreateInput {
		return {
			id: entity.id.toString(),
			clinicId: entity.clinicId.toString(),
			name: entity.name,
			email: entity.email,
			phone: entity.phone,
			preferredChannel: entity.preferredChannel,
			contactStatus: entity.contactStatus,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt ?? entity.createdAt,
		};
	}
}
