import { MockProxy, mock } from 'vitest-mock-extended';

import { InstallmentRepository } from '@/modules/installments/application/repositories/installment.repository';

export function makeInstallmentRepositoryMock(): MockProxy<InstallmentRepository> {
	return mock<InstallmentRepository>();
}
