import { Module } from '@nestjs/common';

import { ClinicsModule } from '@/modules/clinics/clinics.module';
import { InstallmentRepository } from '@/modules/installments/application/repositories/installment.repository';
import { InstallmentsQueryRepository } from '@/modules/installments/application/repositories/installments-query.repository';
import { ListInstallmentsUseCase } from '@/modules/installments/application/use-cases/list-installments.use-case';
import { PrismaInstallmentRepository } from '@/modules/installments/infrastructure/prisma/prisma-installment.repository';
import { PrismaInstallmentsQueryRepository } from '@/modules/installments/infrastructure/prisma/prisma-installments-query.repository';
import { InstallmentsController } from '@/modules/installments/presentation/http/installments.controller';

@Module({
	imports: [ClinicsModule],
	providers: [
		ListInstallmentsUseCase,
		{
			provide: InstallmentRepository,
			useClass: PrismaInstallmentRepository,
		},
		{
			provide: InstallmentsQueryRepository,
			useClass: PrismaInstallmentsQueryRepository,
		},
	],
	controllers: [InstallmentsController],
	exports: [InstallmentRepository, ListInstallmentsUseCase],
})
export class InstallmentsModule {}
