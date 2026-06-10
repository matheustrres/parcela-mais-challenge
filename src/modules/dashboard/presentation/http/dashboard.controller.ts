import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { GetDashboardSummaryUseCase } from '@/modules/dashboard/application/use-cases/get-dashboard-summary.use-case';

import { ClinicScopedReferenceDateQueryDto } from '@/shared/presentation/http/dtos/clinic-scoped-reference-date-query.dto';
import { SwaggerRoute } from '@/shared/swagger';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
	constructor(
		private readonly getDashboardSummaryUseCase: GetDashboardSummaryUseCase,
	) {}

	@Get('summary')
	@SwaggerRoute({
		operation: 'Get dashboard summary',
		queries: [
			{ name: 'clinicId', required: true, type: String, format: 'uuid' },
			{
				name: 'referenceDate',
				required: true,
				type: String,
				format: 'date-time',
			},
		],
		responses: [{ status: 200, description: 'Dashboard summary returned.' }],
	})
	getSummary(@Query() query: ClinicScopedReferenceDateQueryDto) {
		return this.getDashboardSummaryUseCase.exec(query);
	}
}
