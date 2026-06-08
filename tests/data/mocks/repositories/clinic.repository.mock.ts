import { MockProxy, mock } from 'vitest-mock-extended';

import { ClinicRepository } from '@/modules/clinics/application/repositories/clinic.repository';

export function makeClinicRepositoryMock(): MockProxy<ClinicRepository> {
	return mock<ClinicRepository>();
}
