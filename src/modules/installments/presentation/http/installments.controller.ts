import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ListInstallmentsUseCase } from '@/modules/installments/application/use-cases/list-installments.use-case';

import { ClinicScopedReferenceDatePaginationQueryDto } from '@/shared/presentation/http/dtos/clinic-scoped-reference-date-pagination-query.dto';
import { SwaggerRoute } from '@/shared/swagger';

@ApiTags('installments')
@Controller('installments')
export class InstallmentsController {
	constructor(
		private readonly listInstallmentsUseCase: ListInstallmentsUseCase,
	) {}

	@Get()
	@SwaggerRoute({
		operation: 'List installments',
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
		responses: [{ status: 200, description: 'Installments listed.' }],
	})
	list(@Query() query: ClinicScopedReferenceDatePaginationQueryDto) {
		return this.listInstallmentsUseCase.exec(query);
	}
}
