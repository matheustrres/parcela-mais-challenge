import { Body, Controller, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { ProcessSimulatedPaymentWebhookUseCase } from '@/modules/payments/application/use-cases/process-simulated-payment-webhook.use-case';
import { ProcessSimulatedPaymentWebhookRequestDto } from '@/modules/payments/presentation/http/dtos/process-simulated-payment-webhook.request.dto';

import { SwaggerRoute } from '@/shared/swagger';

@ApiTags('payments')
@Controller('webhooks/payments')
export class PaymentWebhooksController {
	constructor(
		private readonly processSimulatedPaymentWebhookUseCase: ProcessSimulatedPaymentWebhookUseCase,
	) {}

	@Post('simulated')
	@SwaggerRoute({
		operation: 'Process simulated payment webhook',
		body: ProcessSimulatedPaymentWebhookRequestDto,
		responses: [
			{ status: 201, description: 'Webhook processed.' },
			{ status: 200, description: 'Webhook replay absorbed.' },
		],
	})
	async processSimulatedWebhook(
		@Body() body: ProcessSimulatedPaymentWebhookRequestDto,
		@Res({ passthrough: true }) response: Response,
	) {
		const output = await this.processSimulatedPaymentWebhookUseCase.exec(body);
		response.status(output.webhookReplay ? 200 : 201);
		return output;
	}
}
