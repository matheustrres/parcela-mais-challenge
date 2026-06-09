import { MockProxy, mock } from 'vitest-mock-extended';

import { DelinquentPatientsQueryRepository } from '@/modules/collections/application/repositories/delinquent-patients-query.repository';

export function makeDelinquentPatientsQueryRepositoryMock(): MockProxy<DelinquentPatientsQueryRepository> {
	return mock<DelinquentPatientsQueryRepository>();
}
