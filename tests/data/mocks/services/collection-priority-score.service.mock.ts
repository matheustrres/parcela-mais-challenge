import { MockProxy, mock } from 'vitest-mock-extended';

import { CollectionPriorityScoreDomainService } from '@/modules/collections/domain/services/collection-priority-score.service';

export function makeCollectionPriorityScoreServiceMock(): MockProxy<CollectionPriorityScoreDomainService> {
	return mock<CollectionPriorityScoreDomainService>();
}
