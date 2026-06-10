import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreateDebtAgreementUseCase } from '@/modules/debt-agreements/application/use-cases/create-debt-agreement.use-case';
import { CreateDebtAgreementRequestDto } from '@/modules/debt-agreements/presentation/http/dtos/create-debt-agreement.request.dto';

import { SwaggerRoute } from '@/shared/swagger';

@ApiTags('debt-agreements')
@Controller('debt-agreements')
export class DebtAgreementsController {
	constructor(
		private readonly createDebtAgreementUseCase: CreateDebtAgreementUseCase,
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
}
