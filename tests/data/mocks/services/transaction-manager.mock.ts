import { MockProxy, mock } from 'vitest-mock-extended';

import {
	TransactionContext,
	TransactionManager,
} from '@/@core/application/transaction-manager';

export type TransactionManagerMockBundle = {
	transactionManager: MockProxy<TransactionManager>;
	txContext: TransactionContext;
};

export function makeTransactionManagerMock(): TransactionManagerMockBundle {
	const txContext: TransactionContext = { scope: 'tx' };
	const transactionManager = mock<TransactionManager>();

	transactionManager.run.mockImplementation(
		async <T>(callback: (tx: TransactionContext) => Promise<T>) =>
			callback(txContext),
	);

	return {
		transactionManager,
		txContext,
	};
}
