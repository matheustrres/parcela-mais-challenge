import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';

import { CollectionsModule } from '@/modules/collections/collections.module';
import { DebtAgreementsModule } from '@/modules/debt-agreements/debt-agreements.module';
import { PaymentsModule } from '@/modules/payments/payments.module';

import { GlobalExceptionFilter } from '@/shared/exceptions/global-exception-filter';
import { RequestIdMiddleware } from '@/shared/middlewares/request-id.middleware';
import { DatabaseModule } from '@/shared/modules/database/database.module';
import { EnvModule } from '@/shared/modules/env/env.module';

@Module({
	imports: [
		EnvModule,
		DatabaseModule,
		LoggerModule.forRoot({
			pinoHttp: {
				autoLogging: false,
				base: null,
				quietResLogger: true,
				genReqId: (request: IncomingMessage) =>
					(request as IncomingMessage & { id?: string }).id || randomUUID(),
				serializers: {
					err: (err) => ({
						type: err.constructor?.name,
						message: err.message,
						// stack: err.stack,
						...(err.response?.statusCode && {
							statusCode: err.response.statusCode,
						}),
					}),
					req(req) {
						return {
							id: req.id,
							method: req.method,
							url: req.url,
							remoteAddress: req.remoteAddress,
						};
					},
				},
				redact: {
					paths: [
						'req.headers.authorization',
						'req.headers.cookie',
						'*.password',
						'*.senha',
						'*.secret',
						'*.token',
						'*.accessToken',
						'*.refreshToken',
						'*.cpf',
						'*.cnpj',
						'*.bankAccount',
						'*.amount',
						'*.baseSalary',
						'*.totalCost',
						'*.totalBenefits',
						'*.customValue',
					],
					censor: '[REDACTED]',
				},
				customProps: (req: any) => {
					const user = req.user as
						| { sub?: string; tenantId?: string }
						| undefined;
					return {
						correlationId: req.id,
						...(user?.tenantId && { tenantId: user.tenantId }),
						...(user?.sub && { userId: user.sub }),
					};
				},
			},
		}),
		CollectionsModule,
		DebtAgreementsModule,
		PaymentsModule,
	],
	providers: [
		AppService,
		{
			provide: APP_FILTER,
			useClass: GlobalExceptionFilter,
		},
	],
	controllers: [AppController],
})
export class AppModule implements NestModule {
	configure(consumer: MiddlewareConsumer): void {
		consumer.apply(RequestIdMiddleware).forRoutes('*');
	}
}
