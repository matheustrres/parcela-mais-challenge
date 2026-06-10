import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreateDebtAgreementUseCase } from '@/modules/debt-agreements/application/use-cases/create-debt-agreement.use-case';
import { GetDebtAgreementUseCase } from '@/modules/debt-agreements/application/use-cases/get-debt-agreement.use-case';
import { ListDebtAgreementsUseCase } from '@/modules/debt-agreements/application/use-cases/list-debt-agreements.use-case';
import { CreateDebtAgreementRequestDto } from '@/modules/debt-agreements/presentation/http/dtos/create-debt-agreement.request.dto';
import { GetDebtAgreementQueryDto } from '@/modules/debt-agreements/presentation/http/dtos/get-debt-agreement-query.dto';
import { ListDebtAgreementsQueryDto } from '@/modules/debt-agreements/presentation/http/dtos/list-debt-agreements-query.dto';

import { SwaggerRoute } from '@/shared/swagger';

@ApiTags('debt-agreements')
@Controller('debt-agreements')
export class DebtAgreementsController {
	constructor(
		private readonly createDebtAgreementUseCase: CreateDebtAgreementUseCase,
		private readonly getDebtAgreementUseCase: GetDebtAgreementUseCase,
		private readonly listDebtAgreementsUseCase: ListDebtAgreementsUseCase,
	) {}

	@Post()
	@SwaggerRoute({
		operation: 'Create debt agreement',
		body: CreateDebtAgreementRequestDto,
		responses: [{ status: 201, description: 'Debt agreement created.' }],
	})
	create(@Body() body: CreateDebtAgreementRequestDto) {
		return this.createDebtAgreementUseCase.exec(body);
	}

	@Get()
	@SwaggerRoute({
		operation: 'List debt agreements',
		queries: [
			{ name: 'clinicId', required: true, type: String, format: 'uuid' },
			{ name: 'patientId', required: false, type: String, format: 'uuid' },
			{
				name: 'status',
				required: false,
				enum: ['ACTIVE', 'PAID', 'CANCELED'],
			},
			{
				name: 'referenceDate',
				required: false,
				type: String,
				format: 'date-time',
				description:
					'Optional date used for overdue calculation. Response returns the resolved referenceDate.',
			},
			{ name: 'limit', required: false, type: Number },
			{ name: 'offset', required: false, type: Number },
		],
		responses: [{ status: 200, description: 'Debt agreements listed.' }],
	})
	list(@Query() query: ListDebtAgreementsQueryDto) {
		return this.listDebtAgreementsUseCase.exec(query);
	}

	@Get(':id')
	@SwaggerRoute({
		operation: 'Get debt agreement',
		params: [{ name: 'id', required: true, type: String, format: 'uuid' }],
		queries: [
			{ name: 'clinicId', required: true, type: String, format: 'uuid' },
			{
				name: 'referenceDate',
				required: true,
				type: String,
				format: 'date-time',
			},
		],
		responses: [{ status: 200, description: 'Debt agreement returned.' }],
	})
	getById(@Param('id') id: string, @Query() query: GetDebtAgreementQueryDto) {
		return this.getDebtAgreementUseCase.exec({
			debtAgreementId: id,
			...query,
		});
	}
}
