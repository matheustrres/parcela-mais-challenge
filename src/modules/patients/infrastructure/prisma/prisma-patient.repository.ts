import { Injectable } from '@nestjs/common';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';

import { PatientRepository } from '@/modules/patients/application/repositories/patient.repository';
import { PatientEntity } from '@/modules/patients/domain/entities/patient.entity';
import { PatientPrismaMapper } from '@/modules/patients/infrastructure/prisma/patient-prisma.mapper';

import { DatabaseService } from '@/shared/modules/database/database.service';

@Injectable()
export class PrismaPatientRepository implements PatientRepository {
	constructor(private readonly databaseService: DatabaseService) {}

	async findById(id: EntityUuid): Promise<PatientEntity | null> {
		const patient = await this.databaseService.patient.findUnique({
			where: {
				id: id.toString(),
			},
		});
		if (!patient) return null;
		return PatientPrismaMapper.toDomain(patient);
	}
}
