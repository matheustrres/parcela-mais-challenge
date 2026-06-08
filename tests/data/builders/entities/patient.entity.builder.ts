import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { ECommunicationChannel, EContactStatus } from '@/@core/enums/domain';

import { PatientEntity } from '@/modules/patients/domain/entities/patient.entity';

type BuildPatientEntityOverrides = {
	id?: string;
	name?: string;
	clinicId?: string;
	email?: string | null;
	phone?: string | null;
	preferredChannel?: ECommunicationChannel | null;
	contactStatus?: EContactStatus;
};

export function buildPatientEntity(
	overrides: BuildPatientEntityOverrides = {},
): PatientEntity {
	return PatientEntity.createFrom(
		EntityUuid.createFrom(overrides.id ?? 'patient-1'),
		{
			name: overrides.name ?? 'Patient Test',
			clinicId: EntityUuid.createFrom(overrides.clinicId ?? 'clinic-1'),
			email: overrides.email ?? 'patient@example.com',
			phone: overrides.phone ?? '11999999999',
			preferredChannel: overrides.preferredChannel ?? null,
			contactStatus: overrides.contactStatus ?? EContactStatus.Active,
		},
	);
}
