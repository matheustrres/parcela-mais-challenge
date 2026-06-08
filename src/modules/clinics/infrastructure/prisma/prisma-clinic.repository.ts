import { Injectable } from '@nestjs/common';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';

import { ClinicRepository } from '@/modules/clinics/application/repositories/clinic.repository';
import { ClinicEntity } from '@/modules/clinics/domain/entities/clinic.entity';

import { DatabaseService } from '@/shared/modules/database/database.service';

@Injectable()
export class PrismaClinicRepository extends ClinicRepository {
	constructor(private readonly databaseService: DatabaseService) {
		super();
	}

	async findById(id: EntityUuid): Promise<ClinicEntity | null> {
		const clinic = await this.databaseService.clinic.findUnique({
			where: {
				id: id.toString(),
			},
		});

		if (!clinic) {
			return null;
		}

		return ClinicEntity.createFrom(
			EntityUuid.createFrom(clinic.id),
			{
				name: clinic.name,
			},
			{
				createdAt: clinic.createdAt,
				updatedAt: clinic.updatedAt,
			},
		);
	}
}
