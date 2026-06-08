import './shared/module-alias';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from '@/app.module';

import { ENodeEnv } from '@/@core/enums/node-env';

import { EnvService } from '@/shared/modules/env/env.service';
import { setupSwaggerDocs } from '@/shared/swagger';

enum ExitStatusEnum {
	FAILURE = 1,
	SUCCESS = 0,
}

enum ExitMessageEnum {
	FAILURE = 'App exited with an error:',
	SUCCESS = 'App exited successfully',
	UNCAUGHT_EXCEPTION = 'App exited due to an uncaught exception:',
	UNHANDLED_REJECTION = 'App exited due to an unhandled rejection:',
}

function exitWithSuccess(): never {
	console.log(ExitMessageEnum.SUCCESS);
	process.exit(ExitStatusEnum.SUCCESS);
}

function exitWithFailure(message?: string, error?: unknown): never {
	console.error(message, error);
	process.exit(ExitStatusEnum.FAILURE);
}

process.on('uncaughtException', (error: Error): never =>
	exitWithFailure(ExitMessageEnum.UNCAUGHT_EXCEPTION, error),
);

process.on('unhandledRejection', (reason: unknown) => {
	exitWithFailure(ExitMessageEnum.UNHANDLED_REJECTION, reason);
});

(async () => {
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		bodyParser: false,
	});
	const logger = app.get(Logger);
	app.useLogger(logger);
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		}),
	);
	app.use(
		json({
			limit: '100kb',
			verify: (req: any, _res, buf) => {
				req.rawBody = buf;
			},
		}),
	);
	app.use(
		urlencoded({
			extended: true,
			limit: '100kb',
			verify: (req: any, _res, buf) => {
				req.rawBody = buf;
			},
		}),
	);
	const envService = app.get(EnvService);
	const corsOrigins = envService
		.getKeyOrThrow('CORS_ORIGINS')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	app.enableCors({
		origin: corsOrigins,
		credentials: true,
	});
	const isProduction =
		envService.getKeyOrThrow('NODE_ENV') === ENodeEnv.Production;
	app.use(
		helmet({
			contentSecurityPolicy: isProduction
				? {
						directives: {
							defaultSrc: ["'self'"],
							scriptSrc: ["'self'"],
							styleSrc: ["'self'"],
							imgSrc: ["'self'"],
						},
					}
				: false,
		}),
	);
	const appPort = envService.getKeyOrThrow('PORT');
	const logMessages: string[] = [];
	if (!isProduction) {
		setupSwaggerDocs(app);
		logMessages.push(`API client available at http://localhost:${appPort}/api`);
	}
	await app.listen(appPort).then(() => {
		logger.debug(`HTTP server running on port ${appPort}.`);
		if (logMessages.length) {
			logMessages.forEach((msg) => logger.debug(msg));
		}
	});
	const exitSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
	for (const signal of exitSignals) {
		process.on(signal, async () => {
			try {
				await app.close();
				exitWithSuccess();
			} catch (error) {
				exitWithFailure(ExitMessageEnum.FAILURE, error);
			}
		});
	}
})();
