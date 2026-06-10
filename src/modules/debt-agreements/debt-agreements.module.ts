import { Module } from '@nestjs/common';

import { ClinicsModule } from '@/modules/clinics/clinics.module';
import { DebtAgreementRepository } from '@/modules/debt-agreements/application/repositories/debt-agreement.repository';
import { CreateDebtAgreementUseCase } from '@/modules/debt-agreements/application/use-cases/create-debt-agreement.use-case';
import { InstallmentSchedulePolicyDomainService } from '@/modules/debt-agreements/domain/services/installment-schedule-policy.service';
import { PrismaDebtAgreementRepository } from '@/modules/debt-agreements/infrastructure/prisma/prisma-debt-agreement.repository';
import { DebtAgreementsController } from '@/modules/debt-agreements/presentation/http/debt-agreements.controller';
import { InstallmentsModule } from '@/modules/installments/installments.module';
import { PatientsModule } from '@/modules/patients/patients.module';

@Module({
	imports: [ClinicsModule, InstallmentsModule, PatientsModule],
	providers: [
		CreateDebtAgreementUseCase,
		InstallmentSchedulePolicyDomainService,
		{
			provide: DebtAgreementRepository,
			useClass: PrismaDebtAgreementRepository,
		},
	],
	controllers: [DebtAgreementsController],
	exports: [CreateDebtAgreementUseCase, DebtAgreementRepository],
})
export class DebtAgreementsModule {}
