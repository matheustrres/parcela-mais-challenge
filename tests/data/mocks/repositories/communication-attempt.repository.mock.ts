import { MockProxy, mock } from 'vitest-mock-extended';

import { CommunicationAttemptRepository } from '@/modules/communications/application/repositories/communication-attempt.repository';

export function makeCommunicationAttemptRepositoryMock(): MockProxy<CommunicationAttemptRepository> {
	return mock<CommunicationAttemptRepository>();
}
