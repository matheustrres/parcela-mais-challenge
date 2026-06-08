import { EntityUuid } from '@/@core/domain/entities/entity-uuid';

import { ClinicEntity } from '@/modules/clinics/domain/entities/clinic.entity';

type BuildClinicEntityOverrides = {
	id?: string;
	name?: string;
};

export function buildClinicEntity(
	overrides: BuildClinicEntityOverrides = {},
): ClinicEntity {
	return ClinicEntity.createFrom(
		EntityUuid.createFrom(overrides.id ?? 'clinic-1'),
		{
			name: overrides.name ?? 'Clinic Test',
		},
	);
}
