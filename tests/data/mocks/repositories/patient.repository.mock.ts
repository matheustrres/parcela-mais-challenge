import { MockProxy, mock } from 'vitest-mock-extended';

import { PatientRepository } from '@/modules/patients/application/repositories/patient.repository';

export function makePatientRepositoryMock(): MockProxy<PatientRepository> {
	return mock<PatientRepository>();
}
