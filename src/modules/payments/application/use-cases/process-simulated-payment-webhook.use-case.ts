import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { UseCase } from '@/@core/application/use-case';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { EPaymentMethod, EPaymentWebhookStatus } from '@/@core/enums/domain';

import { InstallmentRepository } from '@/modules/installments/application/repositories/installment.repository';
import { PaymentWebhookEventRepository } from '@/modules/payment-webhook-events/application/repositories/payment-webhook-event.repository';
import { PaymentWebhookEventEntity } from '@/modules/payment-webhook-events/domain/entities/payment-webhook-event.entity';
import { PaymentRepository } from '@/modules/payments/application/repositories/payment.repository';
import {
	NormalizedSimulatedPaymentWebhookPayload,
	SimulatedPaymentWebhookPayloadService,
} from '@/modules/payments/application/services/simulated-payment-webhook-payload.service';
import {
	RegisterPaymentOutput,
	RegisterPaymentUseCase,
} from '@/modules/payments/application/use-cases/register-payment.use-case';

export type ProcessSimulatedPaymentWebhookInput = {
	provider: string;
	eventId: string;
	clinicId: string;
	installmentId: string;
	externalReference?: string | null;
	amountCents: number;
	method: EPaymentMethod;
	paidAt: Date;
};

export type ProcessSimulatedPaymentWebhookOutput = Omit<
	RegisterPaymentOutput,
	'reused'
> & {
	webhookEventId: string;
	provider: string;
	eventId: string;
	webhookStatus: EPaymentWebhookStatus;
	webhookReplay: boolean;
	paymentReused: boolean;
};

type ClassifiedWebhookError = {
	code: string;
	retryable: boolean;
	message: string | null;
	cause: Error;
};

@Injectable()
export class ProcessSimulatedPaymentWebhookUseCase implements UseCase<
	ProcessSimulatedPaymentWebhookInput,
	ProcessSimulatedPaymentWebhookOutput
> {
	private static readonly nonRetryableErrorCodes = new Set([
		'INSTALLMENT_NOT_FOUND',
		'INSTALLMENT_ALREADY_PAID',
		'PAYMENT_AMOUNT_EXCEEDS_INSTALLMENT_BALANCE',
		'EXTERNAL_REFERENCE_PAYLOAD_MISMATCH',
		'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
		'PAYMENT_WEBHOOK_EVENT_PAYLOAD_MISMATCH',
	]);

	constructor(
		private readonly payloadService: SimulatedPaymentWebhookPayloadService,
		private readonly webhookEventRepository: PaymentWebhookEventRepository,
		private readonly registerPaymentUseCase: RegisterPaymentUseCase,
		private readonly paymentRepository: PaymentRepository,
		private readonly installmentRepository: InstallmentRepository,
		private readonly logger: PinoLogger,
	) {
		this.logger.setContext(ProcessSimulatedPaymentWebhookUseCase.name);
	}

	async exec(
		input: ProcessSimulatedPaymentWebhookInput,
	): Promise<ProcessSimulatedPaymentWebhookOutput> {
		const payload = this.payloadService.normalize(input);
		const payloadHash = this.payloadService.hash(payload);
		const idempotencyKey = this.payloadService.buildIdempotencyKey(payload);

		try {
			const event = await this.getOrCreateEvent(payload, payloadHash);
			return await this.processEvent({
				event,
				payload,
				payloadHash,
				idempotencyKey,
			});
		} catch (error) {
			if (!this.isWebhookUniqueViolation(error)) {
				throw error;
			}
		}

		const event = await this.loadEventOrThrow(payload);
		return this.processEvent({
			event,
			payload,
			payloadHash,
			idempotencyKey,
		});
	}

	private async processEvent(input: {
		event: PaymentWebhookEventEntity;
		payload: NormalizedSimulatedPaymentWebhookPayload;
		payloadHash: string;
		idempotencyKey: string;
	}): Promise<ProcessSimulatedPaymentWebhookOutput> {
		this.ensureClinicIsolation(input.event, input.payload.clinicId);
		this.ensurePayloadHash(input.event, input.payloadHash);

		if (input.event.status === EPaymentWebhookStatus.Processed) {
			return this.rebuildProcessedReplay(input.event);
		}

		if (input.event.status === EPaymentWebhookStatus.Failed) {
			if (input.event.retryable !== true) {
				throw new ApplicationException(
					input.event.errorCode ?? 'WEBHOOK_PROCESSING_FAILED',
				);
			}
			input.event.prepareForRetry();
			await this.webhookEventRepository.update(input.event);
		}

		try {
			const operation = await this.registerPaymentUseCase.exec({
				clinicId: input.payload.clinicId,
				installmentId: input.payload.installmentId,
				amountCents: input.payload.amountCents,
				method: input.payload.method,
				externalReference: input.payload.externalReference,
				idempotencyKey: input.idempotencyKey,
				paidAt: new Date(input.payload.paidAt),
			});

			input.event.markAsProcessed({
				paymentId: EntityUuid.createFrom(operation.paymentId),
				installmentId: EntityUuid.createFrom(operation.installmentId),
				processedAt: new Date(),
			});
			await this.webhookEventRepository.update(input.event);

			const output = this.toWebhookOutput(input.event, operation, false);
			this.logWebhook(input.payload, output, 'processed');
			return output;
		} catch (error) {
			await this.persistFailure(input.event, input.payload, error);
			throw error;
		}
	}

	private async rebuildProcessedReplay(
		event: PaymentWebhookEventEntity,
	): Promise<ProcessSimulatedPaymentWebhookOutput> {
		if (!event.paymentId || !event.installmentId) {
			throw new ApplicationException('WEBHOOK_PROCESSING_FAILED');
		}

		const clinicId = EntityUuid.createFrom(event.clinicId.toString());
		const payment = await this.paymentRepository.findByIdAndClinicId(
			EntityUuid.createFrom(event.paymentId.toString()),
			clinicId,
		);
		const installment = await this.installmentRepository.findByIdAndClinicId(
			EntityUuid.createFrom(event.installmentId.toString()),
			clinicId,
		);

		if (!payment || !installment) {
			throw new ApplicationException('WEBHOOK_PROCESSING_FAILED');
		}

		const output: ProcessSimulatedPaymentWebhookOutput = {
			webhookEventId: event.id.toString(),
			provider: event.provider,
			eventId: event.eventId,
			webhookStatus: event.status,
			paymentId: payment.id.toString(),
			installmentId: installment.id.toString(),
			amountCents: payment.amount.getCents(),
			method: payment.method,
			externalReference: payment.externalReference,
			idempotencyKey: payment.idempotencyKey,
			paidAt: payment.paidAt,
			installmentStatus: installment.status,
			installmentPaidAmountCents: installment.paidAmount.getCents(),
			installmentRemainingAmountCents: installment
				.getRemainingAmount()
				.getCents(),
			webhookReplay: true,
			paymentReused: true,
		};

		this.logWebhook(
			{
				clinicId: event.clinicId.toString(),
				installmentId: event.installmentId.toString(),
				provider: event.provider,
				eventId: event.eventId,
				externalReference: event.externalReference,
				amountCents: payment.amount.getCents(),
				method: payment.method,
				paidAt: payment.paidAt.toISOString(),
			},
			output,
			'replay',
		);

		return output;
	}

	private async getOrCreateEvent(
		payload: NormalizedSimulatedPaymentWebhookPayload,
		payloadHash: string,
	): Promise<PaymentWebhookEventEntity> {
		const existing = await this.webhookEventRepository.findByProviderAndEventId(
			payload.provider,
			payload.eventId,
		);
		if (existing) return existing;
		const event = PaymentWebhookEventEntity.create({
			clinicId: EntityUuid.createFrom(payload.clinicId),
			installmentId: EntityUuid.createFrom(payload.installmentId),
			paymentId: null,
			provider: payload.provider,
			eventId: payload.eventId,
			externalReference: payload.externalReference,
			payload,
			payloadHash,
			status: EPaymentWebhookStatus.Received,
			processedAt: null,
			errorCode: null,
			retryable: null,
			errorMessage: null,
		});
		await this.webhookEventRepository.create(event);
		return event;
	}

	private async loadEventOrThrow(
		payload: NormalizedSimulatedPaymentWebhookPayload,
	): Promise<PaymentWebhookEventEntity> {
		const event = await this.webhookEventRepository.findByProviderAndEventId(
			payload.provider,
			payload.eventId,
		);
		if (!event) {
			throw new ApplicationException('WEBHOOK_PROCESSING_FAILED');
		}
		return event;
	}

	private ensureClinicIsolation(
		event: PaymentWebhookEventEntity,
		clinicId: string,
	): void {
		if (event.clinicId.toString() !== clinicId) {
			throw new ApplicationException('PAYMENT_WEBHOOK_EVENT_PAYLOAD_MISMATCH');
		}
	}

	private ensurePayloadHash(
		event: PaymentWebhookEventEntity,
		payloadHash: string,
	): void {
		if (event.payloadHash !== payloadHash) {
			throw new ApplicationException('PAYMENT_WEBHOOK_EVENT_PAYLOAD_MISMATCH');
		}
	}

	private async persistFailure(
		event: PaymentWebhookEventEntity,
		payload: NormalizedSimulatedPaymentWebhookPayload,
		error: unknown,
	): Promise<void> {
		const classified = this.classifyError(error);
		event.markAsFailed({
			errorCode: classified.code,
			retryable: classified.retryable,
			errorMessage: classified.message,
		});
		await this.webhookEventRepository.update(event);
		this.logWebhook(
			payload,
			{ webhookReplay: false, paymentReused: false },
			'failed',
			classified.code,
		);
	}

	private classifyError(error: unknown): ClassifiedWebhookError {
		if (error instanceof ApplicationException) {
			return {
				code: error.code,
				retryable:
					!ProcessSimulatedPaymentWebhookUseCase.nonRetryableErrorCodes.has(
						error.code,
					),
				message: error.message === error.code ? null : error.message,
				cause: error,
			};
		}

		if (error instanceof Error) {
			return {
				code: 'WEBHOOK_PROCESSING_FAILED',
				retryable: true,
				message: error.message || null,
				cause: error,
			};
		}

		return {
			code: 'WEBHOOK_PROCESSING_FAILED',
			retryable: true,
			message: null,
			cause: new Error('Unknown webhook processing failure'),
		};
	}

	private isWebhookUniqueViolation(error: unknown): boolean {
		return (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === 'P2002'
		);
	}

	private toWebhookOutput(
		event: PaymentWebhookEventEntity,
		output: RegisterPaymentOutput,
		webhookReplay: boolean,
	): ProcessSimulatedPaymentWebhookOutput {
		return {
			webhookEventId: event.id.toString(),
			provider: event.provider,
			eventId: event.eventId,
			webhookStatus: event.status,
			paymentId: output.paymentId,
			installmentId: output.installmentId,
			amountCents: output.amountCents,
			method: output.method,
			externalReference: output.externalReference,
			idempotencyKey: output.idempotencyKey,
			paidAt: output.paidAt,
			installmentStatus: output.installmentStatus,
			installmentPaidAmountCents: output.installmentPaidAmountCents,
			installmentRemainingAmountCents: output.installmentRemainingAmountCents,
			webhookReplay,
			paymentReused: output.reused,
		};
	}

	private logWebhook(
		payload: {
			clinicId: string;
			installmentId: string;
			provider: string;
			eventId: string;
			externalReference?: string | null;
			amountCents?: number;
			method?: EPaymentMethod;
			paidAt?: string;
		},
		output: {
			webhookReplay: boolean;
			paymentReused: boolean;
		},
		status: string,
		errorCode?: string,
	): void {
		this.logger.assign({
			clinicId: payload.clinicId,
			installmentId: payload.installmentId,
			provider: payload.provider,
			eventId: payload.eventId,
			operation: 'process-simulated-payment-webhook',
			status,
			...(errorCode && { errorCode }),
			webhookReplay: output.webhookReplay,
			paymentReused: output.paymentReused,
		});
		this.logger.info('Simulated payment webhook handled');
	}
}
