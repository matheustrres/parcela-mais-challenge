import { MockProxy, mock } from 'vitest-mock-extended';

import { InstallmentSchedulePolicyDomainService } from '@/modules/debt-agreements/domain/services/installment-schedule-policy.service';

export function makeInstallmentSchedulePolicyServiceMock(): MockProxy<InstallmentSchedulePolicyDomainService> {
	return mock<InstallmentSchedulePolicyDomainService>();
}
