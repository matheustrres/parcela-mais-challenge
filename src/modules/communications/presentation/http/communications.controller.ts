import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ListCommunicationAttemptsUseCase } from '@/modules/communications/application/use-cases/list-communication-attempts.use-case';

import { ClinicScopedPaginationQueryDto } from '@/shared/presentation/http/dtos/clinic-scoped-pagination-query.dto';
import { SwaggerRoute } from '@/shared/swagger';

@ApiTags('communications')
@Controller('communication-attempts')
export class CommunicationsController {
	constructor(
		private readonly listCommunicationAttemptsUseCase: ListCommunicationAttemptsUseCase,
	) {}

	@Get()
	@SwaggerRoute({
		operation: 'List communication attempts',
		queries: [
			{ name: 'clinicId', required: true, type: String, format: 'uuid' },
			{ name: 'limit', required: false, type: Number },
			{ name: 'offset', required: false, type: Number },
		],
		responses: [{ status: 200, description: 'Communication attempts listed.' }],
	})
	list(@Query() query: ClinicScopedPaginationQueryDto) {
		return this.listCommunicationAttemptsUseCase.exec(query);
	}
}
