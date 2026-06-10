import { Module } from '@nestjs/common';

import { InstallmentsModule } from '@/modules/installments/installments.module';
import { PaymentWebhookEventRepository } from '@/modules/payment-webhook-events/application/repositories/payment-webhook-event.repository';
import { PrismaPaymentWebhookEventRepository } from '@/modules/payment-webhook-events/infrastructure/prisma/prisma-payment-webhook-event.repository';
import { PaymentRepository } from '@/modules/payments/application/repositories/payment.repository';
import { PaymentIdempotencyPayloadHasherService } from '@/modules/payments/application/services/payment-idempotency-payload-hasher.service';
import { SimulatedPaymentWebhookPayloadService } from '@/modules/payments/application/services/simulated-payment-webhook-payload.service';
import { ProcessSimulatedPaymentWebhookUseCase } from '@/modules/payments/application/use-cases/process-simulated-payment-webhook.use-case';
import { RegisterPaymentUseCase } from '@/modules/payments/application/use-cases/register-payment.use-case';
import { PrismaPaymentRepository } from '@/modules/payments/infrastructure/prisma/prisma-payment.repository';
import { PaymentWebhooksController } from '@/modules/payments/presentation/http/payment-webhooks.controller';
import { PaymentsController } from '@/modules/payments/presentation/http/payments.controller';

@Module({
	imports: [InstallmentsModule],
	providers: [
		RegisterPaymentUseCase,
		ProcessSimulatedPaymentWebhookUseCase,
		PaymentIdempotencyPayloadHasherService,
		SimulatedPaymentWebhookPayloadService,
		{
			provide: PaymentRepository,
			useClass: PrismaPaymentRepository,
		},
		{
			provide: PaymentWebhookEventRepository,
			useClass: PrismaPaymentWebhookEventRepository,
		},
	],
	controllers: [PaymentsController, PaymentWebhooksController],
	exports: [
		RegisterPaymentUseCase,
		ProcessSimulatedPaymentWebhookUseCase,
		PaymentRepository,
		PaymentWebhookEventRepository,
	],
})
export class PaymentsModule {}
