import { Module } from '@nestjs/common';

import { InstallmentsModule } from '@/modules/installments/installments.module';
import { PaymentRepository } from '@/modules/payments/application/repositories/payment.repository';
import { PaymentIdempotencyPayloadHasherService } from '@/modules/payments/application/services/payment-idempotency-payload-hasher.service';
import { RegisterPaymentUseCase } from '@/modules/payments/application/use-cases/register-payment.use-case';
import { PrismaPaymentRepository } from '@/modules/payments/infrastructure/prisma/prisma-payment.repository';
import { PaymentsController } from '@/modules/payments/presentation/http/payments.controller';

@Module({
	imports: [InstallmentsModule],
	providers: [
		RegisterPaymentUseCase,
		PaymentIdempotencyPayloadHasherService,
		{
			provide: PaymentRepository,
			useClass: PrismaPaymentRepository,
		},
	],
	controllers: [PaymentsController],
	exports: [RegisterPaymentUseCase, PaymentRepository],
})
export class PaymentsModule {}
