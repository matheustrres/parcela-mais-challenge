import { MockProxy, mock } from 'vitest-mock-extended';

import { DebtAgreementRepository } from '@/modules/debt-agreements/application/repositories/debt-agreement.repository';

export function makeDebtAgreementRepositoryMock(): MockProxy<DebtAgreementRepository> {
	return mock<DebtAgreementRepository>();
}
