import { Module } from '@nestjs/common';

import { ClinicsModule } from '@/modules/clinics/clinics.module';
import { DebtAgreementQueryRepository } from '@/modules/debt-agreements/application/repositories/debt-agreement-query.repository';
import { DebtAgreementRepository } from '@/modules/debt-agreements/application/repositories/debt-agreement.repository';
import { CreateDebtAgreementUseCase } from '@/modules/debt-agreements/application/use-cases/create-debt-agreement.use-case';
import { GetDebtAgreementUseCase } from '@/modules/debt-agreements/application/use-cases/get-debt-agreement.use-case';
import { ListDebtAgreementsUseCase } from '@/modules/debt-agreements/application/use-cases/list-debt-agreements.use-case';
import { InstallmentSchedulePolicyDomainService } from '@/modules/debt-agreements/domain/services/installment-schedule-policy.service';
import { PrismaDebtAgreementQueryRepository } from '@/modules/debt-agreements/infrastructure/prisma/prisma-debt-agreement-query.repository';
import { PrismaDebtAgreementRepository } from '@/modules/debt-agreements/infrastructure/prisma/prisma-debt-agreement.repository';
import { DebtAgreementsController } from '@/modules/debt-agreements/presentation/http/debt-agreements.controller';
import { InstallmentsModule } from '@/modules/installments/installments.module';
import { PatientsModule } from '@/modules/patients/patients.module';

@Module({
	imports: [ClinicsModule, InstallmentsModule, PatientsModule],
	providers: [
		CreateDebtAgreementUseCase,
		GetDebtAgreementUseCase,
		ListDebtAgreementsUseCase,
		InstallmentSchedulePolicyDomainService,
		{
			provide: DebtAgreementRepository,
			useClass: PrismaDebtAgreementRepository,
		},
		{
			provide: DebtAgreementQueryRepository,
			useClass: PrismaDebtAgreementQueryRepository,
		},
	],
	controllers: [DebtAgreementsController],
	exports: [
		CreateDebtAgreementUseCase,
		GetDebtAgreementUseCase,
		ListDebtAgreementsUseCase,
		DebtAgreementRepository,
		DebtAgreementQueryRepository,
	],
})
export class DebtAgreementsModule {}
