import { Clinic } from '@prisma/client';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';

import { ClinicEntity } from '@/modules/clinics/domain/entities/clinic.entity';

export class ClinicPrismaMapper {
	static toDomain(record: Clinic): ClinicEntity {
		return ClinicEntity.createFrom(
			EntityUuid.createFrom(record.id),
			{
				name: record.name,
			},
			{
				createdAt: record.createdAt,
				updatedAt: record.updatedAt,
			},
		);
	}
}
