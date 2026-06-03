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
	status: EPaymentWebhookStatus;
	processedAt: Date | null;
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

	markAsProcessed(paymentId: EntityId, processedAt: Date): void {
		if (Guard.isEmpty(paymentId)) {
			throw new DomainException('PAYMENT_WEBHOOK_PAYMENT_ID_REQUIRED');
		}
		ensureValidDate(processedAt, 'PAYMENT_WEBHOOK_PROCESSED_AT_REQUIRED');
		this.props.paymentId = paymentId;
		this.props.processedAt = processedAt;
		this.props.status = EPaymentWebhookStatus.Processed;
		this.props.errorMessage = null;
		this.touch();
	}

	markAsDuplicated(): void {
		this.props.status = EPaymentWebhookStatus.Duplicated;
		this.touch();
	}

	markAsFailed(errorMessage: string): void {
		const normalizedMessage = errorMessage.trim();
		if (normalizedMessage.length === 0) {
			throw new DomainException('PAYMENT_WEBHOOK_ERROR_MESSAGE_REQUIRED');
		}
		this.props.status = EPaymentWebhookStatus.Failed;
		this.props.errorMessage = normalizedMessage;
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

	get status(): EPaymentWebhookStatus {
		return this.props.status;
	}

	get processedAt(): Date | null {
		return this.props.processedAt;
	}

	get errorMessage(): string | null {
		return this.props.errorMessage;
	}

	private static normalizeProps(
		props: PaymentWebhookEventEntityProps,
	): PaymentWebhookEventEntityProps {
		return {
			...props,
			provider: props.provider.trim(),
			eventId: props.eventId.trim(),
			externalReference: props.externalReference?.trim() || null,
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
			(Guard.isEmpty(props.paymentId) || props.processedAt === null)
		) {
			throw new DomainException(
				'PROCESSED_PAYMENT_WEBHOOK_REQUIRES_PAYMENT_ID_AND_PROCESSED_AT',
			);
		}
		if (
			props.status === EPaymentWebhookStatus.Failed &&
			Guard.isEmpty(props.errorMessage)
		) {
			throw new DomainException(
				'FAILED_PAYMENT_WEBHOOK_REQUIRES_ERROR_MESSAGE',
			);
		}
	}
}
