import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';

import { GlobalExceptionFilter } from '@/shared/exceptions/global-exception-filter';
import { EnvService } from '@/shared/modules/env/env.service';

describe('GlobalExceptionFilter', () => {
	function makeSut() {
		const reply = vi.fn();
		const getRequestUrl = vi.fn().mockReturnValue('/debt-agreements');
		const httpAdapter = {
			reply,
			getRequestUrl,
		} as unknown as ExpressAdapter;
		const httpAdapterHost = {
			httpAdapter,
		} as HttpAdapterHost<ExpressAdapter>;
		const logger = {
			setContext: vi.fn(),
			assign: vi.fn(),
			error: vi.fn(),
		} as unknown as PinoLogger;
		const envService = {
			getKeyOrThrow: vi.fn().mockReturnValue('development'),
		} as unknown as EnvService;
		const response = {};
		const request = {};
		const argumentsHost = {
			switchToHttp: () => ({
				getResponse: () => response,
				getRequest: () => request,
			}),
		} as ArgumentsHost;

		return {
			filter: new GlobalExceptionFilter(httpAdapterHost, logger, envService),
			reply,
			response,
			argumentsHost,
			logger,
		};
	}

	it('should map application exception to 404 problem details', () => {
		const { filter, reply, response, argumentsHost, logger } = makeSut();

		filter.catch(new ApplicationException('CLINIC_NOT_FOUND'), argumentsHost);

		expect(logger.assign).toHaveBeenCalledWith({
			err: {
				type: 'ApplicationException',
				message: 'CLINIC_NOT_FOUND',
				code: 'CLINIC_NOT_FOUND',
				statusCode: 404,
			},
		});
		expect(reply).toHaveBeenCalledWith(
			response,
			{
				type: `https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Status/404`,
				title: HttpStatus[404],
				status: 404,
				detail: 'CLINIC_NOT_FOUND',
				instance: '/debt-agreements',
			},
			404,
		);
	});

	it('should map application exception to 422 problem details', () => {
		const { filter, reply, response, argumentsHost } = makeSut();

		filter.catch(
			new ApplicationException('PATIENT_DOES_NOT_BELONG_TO_CLINIC'),
			argumentsHost,
		);

		expect(reply).toHaveBeenCalledWith(
			response,
			{
				type: `https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Status/422`,
				title: HttpStatus[422],
				status: 422,
				detail: 'PATIENT_DOES_NOT_BELONG_TO_CLINIC',
				instance: '/debt-agreements',
			},
			422,
		);
	});

	it('should map payment conflict exception to 409 problem details', () => {
		const { filter, reply, response, argumentsHost } = makeSut();

		filter.catch(
			new ApplicationException('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH'),
			argumentsHost,
		);

		expect(reply).toHaveBeenCalledWith(
			response,
			{
				type: `https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Status/409`,
				title: HttpStatus[409],
				status: 409,
				detail: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
				instance: '/debt-agreements',
			},
			409,
		);
	});
});
