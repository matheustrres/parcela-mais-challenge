import { MockProxy, mock } from 'vitest-mock-extended';

import { DebtAgreementQueryRepository } from '@/modules/debt-agreements/application/repositories/debt-agreement-query.repository';

export function makeDebtAgreementQueryRepositoryMock(): MockProxy<DebtAgreementQueryRepository> {
	return mock<DebtAgreementQueryRepository>();
}
