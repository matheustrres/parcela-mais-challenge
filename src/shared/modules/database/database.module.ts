import { Global, Module } from '@nestjs/common';

import { DatabaseService } from './database.service';

import { EnvModule } from '../env/env.module';

import { TransactionManager } from '@/@core/application/transaction-manager';

import { PrismaTransactionManager } from '@/shared/modules/database/prisma-transaction-manager';

@Global()
@Module({
	imports: [EnvModule],
	providers: [
		DatabaseService,
		{
			provide: TransactionManager,
			useClass: PrismaTransactionManager,
		},
	],
	exports: [DatabaseService, TransactionManager],
})
export class DatabaseModule {}
