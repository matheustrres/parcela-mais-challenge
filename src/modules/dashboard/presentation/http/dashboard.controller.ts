import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { GetDashboardSummaryUseCase } from '@/modules/dashboard/application/use-cases/get-dashboard-summary.use-case';
import { GetDashboardSummaryQueryDto } from '@/modules/dashboard/presentation/http/dtos/get-dashboard-summary-query.dto';

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
				required: false,
				type: String,
				format: 'date-time',
				description:
					'Optional reference date used for deterministic operational calculations. Defaults to current server time.',
			},
		],
		responses: [
			{
				status: 200,
				description:
					'Dashboard summary returned. Receivables and installment aggregates include only ACTIVE agreements; canceled agreements appear only in administrative agreement counters. installments.open includes PENDING + PARTIALLY_PAID with open balance; agreements.fullyPaid is a derived paid-agreements counter. suggestedActionSkippedReason returns the first blocking reason according to CollectionRulePolicyDomainService precedence.',
			},
		],
	})
	getSummary(@Query() query: GetDashboardSummaryQueryDto) {
		return this.getDashboardSummaryUseCase.exec(query);
	}
}
