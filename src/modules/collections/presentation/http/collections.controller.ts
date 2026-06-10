import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ListDelinquentPatientsUseCase } from '@/modules/collections/application/use-cases/list-delinquent-patients.use-case';
import { RunCollectionRulesUseCase } from '@/modules/collections/application/use-cases/run-collection-rules.use-case';
import { RunCollectionRulesRequestDto } from '@/modules/collections/presentation/http/dtos/run-collection-rules.request.dto';

import { ClinicScopedReferenceDatePaginationQueryDto } from '@/shared/presentation/http/dtos/clinic-scoped-reference-date-pagination-query.dto';
import { SwaggerRoute } from '@/shared/swagger';

@ApiTags('collections')
@Controller()
export class CollectionsController {
	constructor(
		private readonly runCollectionRulesUseCase: RunCollectionRulesUseCase,
		private readonly listDelinquentPatientsUseCase: ListDelinquentPatientsUseCase,
	) {}

	@Post('collection-rules/run')
	@SwaggerRoute({
		operation: 'Run collection rules',
		body: RunCollectionRulesRequestDto,
		responses: [{ status: 201, description: 'Collection rules evaluated.' }],
	})
	run(@Body() body: RunCollectionRulesRequestDto) {
		return this.runCollectionRulesUseCase.exec(body);
	}

	@Get('delinquents')
	@SwaggerRoute({
		operation: 'List delinquent patients',
		queries: [
			{ name: 'clinicId', required: true, type: String, format: 'uuid' },
			{
				name: 'referenceDate',
				required: true,
				type: String,
				format: 'date-time',
			},
			{ name: 'limit', required: false, type: Number },
			{ name: 'offset', required: false, type: Number },
		],
		responses: [{ status: 200, description: 'Delinquent patients listed.' }],
	})
	listDelinquents(@Query() query: ClinicScopedReferenceDatePaginationQueryDto) {
		return this.listDelinquentPatientsUseCase.exec(query);
	}
}
