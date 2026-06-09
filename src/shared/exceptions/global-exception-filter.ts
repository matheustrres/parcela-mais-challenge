import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { ENodeEnv } from '@/@core/enums/node-env';

import { EnvService } from '@/shared/modules/env/env.service';

type ProblemDetails = {
	type: string;
	title: string;
	status: number;
	detail: string | string[];
	instance: string;
};

type HttpValidationResponse = {
	message: string | string[];
	error: string;
	statusCode: number;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter<unknown> {
	private static readonly applicationErrorStatusMap: Record<string, number> = {
		CLINIC_NOT_FOUND: 404,
		PATIENT_NOT_FOUND: 404,
		PATIENT_DOES_NOT_BELONG_TO_CLINIC: 422,
		INSTALLMENT_NOT_FOUND: 404,
		IDEMPOTENCY_KEY_PAYLOAD_MISMATCH: 409,
		EXTERNAL_REFERENCE_PAYLOAD_MISMATCH: 409,
		PAYMENT_AMOUNT_EXCEEDS_INSTALLMENT_BALANCE: 422,
		INSTALLMENT_ALREADY_PAID: 422,
		INSTALLMENT_CONCURRENT_MODIFICATION: 409,
		INVALID_PAYMENT_PAID_AT: 422,
		INVALID_COLLECTION_REFERENCE_DATE: 422,
		COLLECTION_RULE_ATTEMPT_ALREADY_EXISTS: 409,
	};

	private readonly isProduction: boolean;

	constructor(
		private readonly httpAdapterHost: HttpAdapterHost<ExpressAdapter>,
		private readonly logger: PinoLogger,
		private readonly envService: EnvService,
	) {
		this.isProduction =
			this.envService.getKeyOrThrow('NODE_ENV') === ENodeEnv.Production;
		this.logger.setContext(GlobalExceptionFilter.name);
	}

	catch(exception: unknown, host: ArgumentsHost): void {
		this.#logError('An unhandled exception was caught', exception);
		const { httpAdapter } = this.httpAdapterHost;
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const requestUrl = httpAdapter.getRequestUrl(ctx.getRequest());
		const problemDetails = this.#mapToProblemDetails(exception, requestUrl);
		return this.#sendResponse(httpAdapter, response, problemDetails);
	}

	#mapToProblemDetails(exception: unknown, requestUrl: string): ProblemDetails {
		const defaultStatus = 500;
		const problemDetails: ProblemDetails = {
			type: this.#getType(defaultStatus),
			status: defaultStatus,
			title: 'Internal Server Error',
			detail: 'An unexpected error occurred. Please try again later.',
			instance: requestUrl,
		};
		if (exception instanceof HttpException) {
			const { message, statusCode } =
				exception.getResponse() as HttpValidationResponse;
			return {
				...problemDetails,
				type: this.#getType(statusCode),
				title: HttpStatus[statusCode] || 'Error',
				status: statusCode,
				detail: Array.isArray(message) ? message : [message],
			};
		}
		if (exception instanceof ApplicationException) {
			const statusCode = this.#mapApplicationErrorCode(exception.code);
			return {
				...problemDetails,
				type: this.#getType(statusCode),
				title: HttpStatus[statusCode] || 'Error',
				status: statusCode,
				detail: exception.message,
			};
		}
		if (this.isProduction) {
			if (exception instanceof Prisma.PrismaClientKnownRequestError) {
				return {
					...problemDetails,
					detail: this.#mapPrismaErrorCode(exception.code),
				};
			}
			if (exception instanceof Prisma.PrismaClientValidationError) {
				return {
					...problemDetails,
					detail: 'Erro interno do servidor.',
				};
			}
			return {
				...problemDetails,
				detail: 'Erro interno do servidor.',
			};
		}
		if (exception instanceof Error) {
			return {
				...problemDetails,
				detail: exception.message || problemDetails.detail,
			};
		}
		return problemDetails;
	}

	#mapPrismaErrorCode(code: string): string {
		const prismaErrorMessages: Record<string, string> = {
			P2002: 'Registro duplicado.',
			P2025: 'Registro não encontrado.',
			P2003: 'Referência inválida.',
		};
		return prismaErrorMessages[code] ?? 'Erro interno do servidor.';
	}

	#mapApplicationErrorCode(code: string): number {
		return (
			GlobalExceptionFilter.applicationErrorStatusMap[code] ??
			HttpStatus.UNPROCESSABLE_ENTITY
		);
	}

	#getType(statusCode: number): string {
		return `https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Status/${statusCode}`;
	}

	#logError(message: string, exception: unknown): void {
		const serializedError = this.#serializeError(exception);
		this.logger.assign({ err: serializedError });
		this.logger.error(message);
	}

	#serializeError(exception: unknown): Record<string, unknown> {
		if (exception instanceof HttpException) {
			const response = exception.getResponse() as HttpValidationResponse;
			return {
				type: exception.constructor.name,
				message: exception.message,
				statusCode: response.statusCode,
			};
		}
		if (exception instanceof ApplicationException) {
			return {
				type: exception.constructor.name,
				message: exception.message,
				code: exception.code,
				statusCode: this.#mapApplicationErrorCode(exception.code),
			};
		}
		if (exception instanceof Error) {
			return {
				type: exception.constructor.name,
				message: exception.message,
			};
		}
		return { type: 'Unknown', message: String(exception) };
	}

	#sendResponse(
		httpAdapter: ExpressAdapter,
		response: Response,
		problemDetails: ProblemDetails,
	): void {
		return httpAdapter.reply(response, problemDetails, problemDetails.status);
	}
}
