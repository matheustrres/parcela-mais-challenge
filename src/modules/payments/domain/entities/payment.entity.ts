import {
	CreateEntityProps,
	EntityMeta,
	UpdatableEntity,
} from '@/@core/domain/entities/entity';
import { EntityId } from '@/@core/domain/entities/entity-id';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { DomainException } from '@/@core/domain/exceptions/domain-exception';
import { Guard } from '@/@core/domain/logic/guard';
import { EPaymentMethod } from '@/@core/enums/domain';

type PaymentEntityProps = {
	clinicId: EntityId;
	installmentId: EntityId;
	amount: MoneyVo;
	method: EPaymentMethod;
	externalReference: string | null;
	idempotencyKey: string;
	idempotencyPayloadHash: string;
	paidAt: Date;
};

type PaymentEntityConstructor = CreateEntityProps<PaymentEntityProps>;

export class PaymentEntity extends UpdatableEntity<PaymentEntityProps> {
	private constructor(props: PaymentEntityConstructor) {
		const normalizedProps = PaymentEntity.normalizeProps(props.props);
		PaymentEntity.validateProps(normalizedProps);
		super({
			...props,
			props: normalizedProps,
		});
	}

	static create(props: PaymentEntityProps): PaymentEntity {
		return new PaymentEntity({
			id: EntityUuid.create(),
			props,
		});
	}

	static createFrom(
		id: EntityId,
		props: PaymentEntityProps,
		meta?: EntityMeta,
	): PaymentEntity {
		return new PaymentEntity({
			id,
			props,
			meta,
		});
	}

	isFromWebhook(): boolean {
		return this.props.method === EPaymentMethod.WebhookSimulated;
	}

	hasExternalReference(): boolean {
		return this.props.externalReference !== null;
	}

	get clinicId(): EntityId {
		return this.props.clinicId;
	}

	get installmentId(): EntityId {
		return this.props.installmentId;
	}

	get amount(): MoneyVo {
		return this.props.amount;
	}

	get method(): EPaymentMethod {
		return this.props.method;
	}

	get externalReference(): string | null {
		return this.props.externalReference;
	}

	get idempotencyKey(): string {
		return this.props.idempotencyKey;
	}

	get idempotencyPayloadHash(): string {
		return this.props.idempotencyPayloadHash;
	}

	get paidAt(): Date {
		return this.props.paidAt;
	}

	private static normalizeProps(props: PaymentEntityProps): PaymentEntityProps {
		return {
			...props,
			externalReference: props.externalReference?.trim() || null,
			idempotencyKey: props.idempotencyKey.trim(),
			idempotencyPayloadHash: props.idempotencyPayloadHash.trim(),
		};
	}

	private static validateProps(props: PaymentEntityProps): void {
		if (Guard.isEmpty(props.clinicId)) {
			throw new DomainException('PAYMENT_CLINIC_ID_REQUIRED');
		}
		if (Guard.isEmpty(props.installmentId)) {
			throw new DomainException('PAYMENT_INSTALLMENT_ID_REQUIRED');
		}
		if (!(props.amount instanceof MoneyVo)) {
			throw new DomainException('PAYMENT_AMOUNT_REQUIRED');
		}
		if (!props.amount.isPositive()) {
			throw new DomainException('PAYMENT_AMOUNT_MUST_BE_POSITIVE');
		}
		if (!Object.values(EPaymentMethod).includes(props.method)) {
			throw new DomainException('INVALID_PAYMENT_METHOD');
		}
		if (Guard.isEmpty(props.idempotencyKey)) {
			throw new DomainException('PAYMENT_IDEMPOTENCY_KEY_REQUIRED');
		}
		if (Guard.isEmpty(props.idempotencyPayloadHash)) {
			throw new DomainException('PAYMENT_IDEMPOTENCY_PAYLOAD_HASH_REQUIRED');
		}
		if (
			!(props.paidAt instanceof Date) ||
			Number.isNaN(props.paidAt.getTime())
		) {
			throw new DomainException('PAYMENT_PAID_AT_REQUIRED');
		}
	}
}
