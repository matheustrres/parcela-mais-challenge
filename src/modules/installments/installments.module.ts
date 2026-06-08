import { Module } from '@nestjs/common';

import { InstallmentRepository } from './application/repositories/installment.repository';
import { PrismaInstallmentRepository } from './infrastructure/prisma/prisma-installment.repository';

@Module({
	imports: [],
	providers: [
		{
			provide: InstallmentRepository,
			useClass: PrismaInstallmentRepository,
		},
	],
	controllers: [],
	exports: [InstallmentRepository],
})
export class InstallmentsModule {}
