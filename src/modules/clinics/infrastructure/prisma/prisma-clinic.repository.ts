import { Injectable } from '@nestjs/common';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';

import { ClinicRepository } from '@/modules/clinics/application/repositories/clinic.repository';
import { ClinicEntity } from '@/modules/clinics/domain/entities/clinic.entity';
import { ClinicPrismaMapper } from '@/modules/clinics/infrastructure/prisma/clinic-prisma.mapper';

import { DatabaseService } from '@/shared/modules/database/database.service';

@Injectable()
export class PrismaClinicRepository implements ClinicRepository {
	constructor(private readonly databaseService: DatabaseService) {}

	async findById(id: EntityUuid): Promise<ClinicEntity | null> {
		const clinic = await this.databaseService.clinic.findUnique({
			where: {
				id: id.toString(),
			},
		});
		if (!clinic) return null;
		return ClinicPrismaMapper.toDomain(clinic);
	}
}
