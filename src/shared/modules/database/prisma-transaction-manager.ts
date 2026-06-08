import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
	TransactionContext,
	TransactionManager,
} from '@/@core/application/transaction-manager';

import { DatabaseService } from '@/shared/modules/database/database.service';

export type PrismaTransactionContext = {
	readonly client: Prisma.TransactionClient;
};

@Injectable()
export class PrismaTransactionManager extends TransactionManager {
	constructor(private readonly databaseService: DatabaseService) {
		super();
	}

	async run<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T> {
		return this.databaseService.$transaction((client) => callback({ client }));
	}
}

export function resolvePrismaClient(
	databaseService: DatabaseService,
	tx?: TransactionContext,
): Prisma.TransactionClient | DatabaseService {
	if (isPrismaTransactionContext(tx)) {
		return tx.client;
	}
	return databaseService;
}

function isPrismaTransactionContext(
	tx?: TransactionContext,
): tx is PrismaTransactionContext {
	return !!tx && typeof tx === 'object' && 'client' in tx;
}
