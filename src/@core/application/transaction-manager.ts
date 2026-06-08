export type TransactionContext = unknown;

export abstract class TransactionManager {
	abstract run<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
