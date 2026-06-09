import { MockProxy, mock } from 'vitest-mock-extended';

import { CollectionCommunicationMessageFactoryDomainService } from '@/modules/collections/domain/services/collections-communication-message-factory.service';

export function makeCollectionCommunicationMessageFactoryServiceMock(): MockProxy<CollectionCommunicationMessageFactoryDomainService> {
	return mock<CollectionCommunicationMessageFactoryDomainService>();
}
