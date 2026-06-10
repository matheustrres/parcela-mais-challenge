import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RegisterPaymentUseCase } from '@/modules/payments/application/use-cases/register-payment.use-case';
import { RegisterPaymentRequestDto } from '@/modules/payments/presentation/http/dtos/register-payment.request.dto';

import { SwaggerRoute } from '@/shared/swagger';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
	constructor(
		private readonly registerPaymentUseCase: RegisterPaymentUseCase,
	) {}

	@Post()
	@SwaggerRoute({
		operation: 'Register payment',
		body: RegisterPaymentRequestDto,
		responses: [{ status: 201, description: 'Payment registered.' }],
	})
	create(@Body() body: RegisterPaymentRequestDto) {
		return this.registerPaymentUseCase.exec(body);
	}
}
