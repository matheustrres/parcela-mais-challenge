import { Injectable } from '@nestjs/common';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { ECommunicationChannel, EContactStatus } from '@/@core/enums/domain';

import { PatientRepository } from '@/modules/patients/application/repositories/patient.repository';
import { PatientEntity } from '@/modules/patients/domain/entities/patient.entity';

import { DatabaseService } from '@/shared/modules/database/database.service';

@Injectable()
export class PrismaPatientRepository extends PatientRepository {
	constructor(private readonly databaseService: DatabaseService) {
		super();
	}

	async findById(id: EntityUuid): Promise<PatientEntity | null> {
		const patient = await this.databaseService.patient.findUnique({
			where: {
				id: id.toString(),
			},
		});
		if (!patient) return null;
		return PatientEntity.createFrom(
			EntityUuid.createFrom(patient.id),
			{
				name: patient.name,
				clinicId: EntityUuid.createFrom(patient.clinicId),
				email: patient.email,
				phone: patient.phone,
				preferredChannel:
					patient.preferredChannel as ECommunicationChannel | null,
				contactStatus: patient.contactStatus as EContactStatus,
			},
			{
				createdAt: patient.createdAt,
				updatedAt: patient.updatedAt,
			},
		);
	}
}
