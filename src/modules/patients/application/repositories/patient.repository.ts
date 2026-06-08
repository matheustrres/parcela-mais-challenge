import { EntityId } from '@/@core/domain/entities/entity-id';

import { PatientEntity } from '@/modules/patients/domain/entities/patient.entity';

export abstract class PatientRepository {
	abstract findById(id: EntityId): Promise<PatientEntity | null>;
}
