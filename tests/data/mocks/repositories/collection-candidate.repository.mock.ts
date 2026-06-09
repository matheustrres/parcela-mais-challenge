import { MockProxy, mock } from 'vitest-mock-extended';

import { CollectionCandidateRepository } from '@/modules/collections/application/repositories/collection-candidate.repository';

export function makeCollectionCandidateRepositoryMock(): MockProxy<CollectionCandidateRepository> {
	return mock<CollectionCandidateRepository>();
}
