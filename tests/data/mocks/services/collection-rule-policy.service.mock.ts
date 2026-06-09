import { MockProxy, mock } from 'vitest-mock-extended';

import { CollectionRulePolicyDomainService } from '@/modules/collections/domain/services/collection-rule-policy.service';

export function makeCollectionRulePolicyServiceMock(): MockProxy<CollectionRulePolicyDomainService> {
	return mock<CollectionRulePolicyDomainService>();
}
