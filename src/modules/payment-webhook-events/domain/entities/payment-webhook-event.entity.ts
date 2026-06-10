import {
	CreateEntityProps,
	EntityMeta,
	UpdatableEntity,
} from '@/@core/domain/entities/entity';
import { EntityId } from '@/@core/domain/entities/entity-id';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { DomainException } from '@/@core/domain/exceptions/domain-exception';
import { Guard } from '@/@core/domain/logic/guard';
import { EPaymentWebhookStatus } from '@/@core/enums/domain';

import { ensureValidDate } from '@/shared/utils/ensure-valid-date';

type PaymentWebhookEventEntityProps = {
	clinicId: EntityId;
	installmentId: EntityId | null;
	paymentId: EntityId | null;
	provider: string;
	eventId: string;
	externalReference: string | null;
	payload: Record<string, unknown>;
	payloadHash: string;
	status: EPaymentWebhookStatus;
	processedAt: Date | null;
	errorCode: string | null;
	retryable: boolean | null;
	errorMessage: string | null;
};

type PaymentWebhookEventEntityConstructor =
	CreateEntityProps<PaymentWebhookEventEntityProps>;

export class PaymentWebhookEventEntity extends UpdatableEntity<PaymentWebhookEventEntityProps> {
	private constructor(props: PaymentWebhookEventEntityConstructor) {
		const normalizedProps = PaymentWebhookEventEntity.normalizeProps(
			props.props,
		);
		PaymentWebhookEventEntity.validateProps(normalizedProps);
		super({
			...props,
			props: normalizedProps,
		});
	}

	static create(
		props: PaymentWebhookEventEntityProps,
	): PaymentWebhookEventEntity {
		return new PaymentWebhookEventEntity({
			id: EntityUuid.create(),
			props,
		});
	}

	static createFrom(
		id: EntityId,
		props: PaymentWebhookEventEntityProps,
		meta?: EntityMeta,
	): PaymentWebhookEventEntity {
		return new PaymentWebhookEventEntity({
			id,
			props,
			meta,
		});
	}

	markAsProcessed(input: {
		paymentId: EntityId;
		installmentId: EntityId;
		processedAt: Date;
	}): void {
		if (this.props.status === EPaymentWebhookStatus.Processed) {
			throw new DomainException('PAYMENT_WEBHOOK_ALREADY_PROCESSED');
		}
		if (Guard.isEmpty(input.paymentId)) {
			throw new DomainException('PAYMENT_WEBHOOK_PAYMENT_ID_REQUIRED');
		}
		if (Guard.isEmpty(input.installmentId)) {
			throw new DomainException('PAYMENT_WEBHOOK_INSTALLMENT_ID_REQUIRED');
		}
		ensureValidDate(input.processedAt, 'PAYMENT_WEBHOOK_PROCESSED_AT_REQUIRED');
		this.props.paymentId = input.paymentId;
		this.props.installmentId = input.installmentId;
		this.props.processedAt = input.processedAt;
		this.props.status = EPaymentWebhookStatus.Processed;
		this.props.errorCode = null;
		this.props.retryable = null;
		this.props.errorMessage = null;
		this.touch();
	}

	markAsDuplicated(): void {
		this.props.status = EPaymentWebhookStatus.Duplicated;
		this.touch();
	}

	markAsFailed(input: {
		errorCode: string;
		retryable: boolean;
		errorMessage?: string | null;
	}): void {
		const normalizedCode = input.errorCode.trim();
		const normalizedMessage = input.errorMessage?.trim() || null;
		if (normalizedCode.length === 0) {
			throw new DomainException('PAYMENT_WEBHOOK_ERROR_CODE_REQUIRED');
		}
		this.props.status = EPaymentWebhookStatus.Failed;
		this.props.errorCode = normalizedCode;
		this.props.retryable = input.retryable;
		this.props.errorMessage = normalizedMessage;
		this.touch();
	}

	prepareForRetry(): void {
		if (this.props.status !== EPaymentWebhookStatus.Failed) {
			throw new DomainException('PAYMENT_WEBHOOK_RETRY_REQUIRES_FAILED_STATUS');
		}
		if (this.props.retryable !== true) {
			throw new DomainException('PAYMENT_WEBHOOK_RETRY_REQUIRES_RETRYABLE');
		}
		this.props.status = EPaymentWebhookStatus.Received;
		this.props.errorCode = null;
		this.props.retryable = null;
		this.props.errorMessage = null;
		this.touch();
	}

	get clinicId(): EntityId {
		return this.props.clinicId;
	}

	get installmentId(): EntityId | null {
		return this.props.installmentId;
	}

	get paymentId(): EntityId | null {
		return this.props.paymentId;
	}

	get provider(): string {
		return this.props.provider;
	}

	get eventId(): string {
		return this.props.eventId;
	}

	get externalReference(): string | null {
		return this.props.externalReference;
	}

	get payload(): Record<string, unknown> {
		return this.props.payload;
	}

	get payloadHash(): string {
		return this.props.payloadHash;
	}

	get status(): EPaymentWebhookStatus {
		return this.props.status;
	}

	get processedAt(): Date | null {
		return this.props.processedAt;
	}

	get errorCode(): string | null {
		return this.props.errorCode;
	}

	get retryable(): boolean | null {
		return this.props.retryable;
	}

	get errorMessage(): string | null {
		return this.props.errorMessage;
	}

	private static normalizeProps(
		props: PaymentWebhookEventEntityProps,
	): PaymentWebhookEventEntityProps {
		return {
			...props,
			provider: props.provider.trim().toUpperCase(),
			eventId: props.eventId.trim(),
			externalReference: props.externalReference?.trim() || null,
			payloadHash: props.payloadHash.trim(),
			errorCode: props.errorCode?.trim() || null,
			errorMessage: props.errorMessage?.trim() || null,
		};
	}

	private static validateProps(props: PaymentWebhookEventEntityProps): void {
		if (Guard.isEmpty(props.clinicId)) {
			throw new DomainException('PAYMENT_WEBHOOK_CLINIC_ID_REQUIRED');
		}
		if (Guard.isEmpty(props.provider)) {
			throw new DomainException('PAYMENT_WEBHOOK_PROVIDER_REQUIRED');
		}
		if (Guard.isEmpty(props.eventId)) {
			throw new DomainException('PAYMENT_WEBHOOK_EVENT_ID_REQUIRED');
		}
		if (Guard.isEmpty(props.payload)) {
			throw new DomainException('PAYMENT_WEBHOOK_PAYLOAD_REQUIRED');
		}
		if (Guard.isEmpty(props.payloadHash)) {
			throw new DomainException('PAYMENT_WEBHOOK_PAYLOAD_HASH_REQUIRED');
		}
		if (!Object.values(EPaymentWebhookStatus).includes(props.status)) {
			throw new DomainException('INVALID_PAYMENT_WEBHOOK_STATUS');
		}
		if (props.processedAt !== null) {
			ensureValidDate(
				props.processedAt,
				'PAYMENT_WEBHOOK_PROCESSED_AT_MUST_BE_VALID_DATE',
			);
		}
		if (
			props.status === EPaymentWebhookStatus.Processed &&
			(Guard.isEmpty(props.paymentId) ||
				Guard.isEmpty(props.installmentId) ||
				props.processedAt === null)
		) {
			throw new DomainException(
				'PROCESSED_PAYMENT_WEBHOOK_REQUIRES_PAYMENT_ID_INSTALLMENT_ID_AND_PROCESSED_AT',
			);
		}
		if (
			props.status === EPaymentWebhookStatus.Failed &&
			(Guard.isEmpty(props.errorCode) || props.retryable === null)
		) {
			throw new DomainException(
				'FAILED_PAYMENT_WEBHOOK_REQUIRES_ERROR_CODE_AND_RETRYABLE',
			);
		}
	}
}
