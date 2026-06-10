import { Module } from '@nestjs/common';

import { ClinicsModule } from '@/modules/clinics/clinics.module';
import { DashboardSummaryQueryRepository } from '@/modules/dashboard/application/repositories/dashboard-summary-query.repository';
import { GetDashboardSummaryUseCase } from '@/modules/dashboard/application/use-cases/get-dashboard-summary.use-case';
import { PrismaDashboardSummaryQueryRepository } from '@/modules/dashboard/infrastructure/prisma/prisma-dashboard-summary-query.repository';
import { DashboardController } from '@/modules/dashboard/presentation/http/dashboard.controller';

@Module({
	imports: [ClinicsModule],
	providers: [
		GetDashboardSummaryUseCase,
		{
			provide: DashboardSummaryQueryRepository,
			useClass: PrismaDashboardSummaryQueryRepository,
		},
	],
	controllers: [DashboardController],
	exports: [GetDashboardSummaryUseCase],
})
export class DashboardModule {}
