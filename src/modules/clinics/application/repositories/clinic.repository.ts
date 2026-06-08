import { EntityId } from '@/@core/domain/entities/entity-id';

import { ClinicEntity } from '@/modules/clinics/domain/entities/clinic.entity';

export abstract class ClinicRepository {
	abstract findById(id: EntityId): Promise<ClinicEntity | null>;
}
