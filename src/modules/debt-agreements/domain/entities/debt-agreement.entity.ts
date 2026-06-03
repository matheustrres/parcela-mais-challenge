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
import { EDebtAgreementStatus } from '@/@core/enums/domain';

type DebtAgreementEntityProps = {
	clinicId: EntityId;
	patientId: EntityId;
	totalAmount: MoneyVo;
	installmentsCount: number;
	status: EDebtAgreementStatus;
};

type DebtAgreementEntityConstructor =
	CreateEntityProps<DebtAgreementEntityProps>;

export class DebtAgreementEntity extends UpdatableEntity<DebtAgreementEntityProps> {
	private constructor(props: DebtAgreementEntityConstructor) {
		DebtAgreementEntity.validateProps(props.props);
		super(props);
	}

	static create(props: DebtAgreementEntityProps): DebtAgreementEntity {
		return new DebtAgreementEntity({
			id: EntityUuid.create(),
			props,
		});
	}

	static createFrom(
		id: EntityId,
		props: DebtAgreementEntityProps,
		meta?: EntityMeta,
	): DebtAgreementEntity {
		return new DebtAgreementEntity({
			id,
			props,
			meta,
		});
	}

	cancel(): void {
		if (this.props.status === EDebtAgreementStatus.Paid) {
			throw new DomainException('PAID_DEBT_AGREEMENT_CANNOT_BE_CANCELED');
		}
		if (this.props.status === EDebtAgreementStatus.Canceled) {
			return;
		}
		this.props.status = EDebtAgreementStatus.Canceled;
		this.touch();
	}

	markAsPaid(): void {
		if (this.props.status === EDebtAgreementStatus.Canceled) {
			throw new DomainException('CANCELED_DEBT_AGREEMENT_CANNOT_BE_PAID');
		}
		if (this.props.status === EDebtAgreementStatus.Paid) {
			return;
		}
		this.props.status = EDebtAgreementStatus.Paid;
		this.touch();
	}

	isActive(): boolean {
		return this.props.status === EDebtAgreementStatus.Active;
	}

	get clinicId(): EntityId {
		return this.props.clinicId;
	}

	get patientId(): EntityId {
		return this.props.patientId;
	}

	get totalAmount(): MoneyVo {
		return this.props.totalAmount;
	}

	get installmentsCount(): number {
		return this.props.installmentsCount;
	}

	get status(): EDebtAgreementStatus {
		return this.props.status;
	}

	private static validateProps(props: DebtAgreementEntityProps): void {
		if (Guard.isEmpty(props.clinicId)) {
			throw new DomainException('DEBT_AGREEMENT_CLINIC_ID_REQUIRED');
		}
		if (Guard.isEmpty(props.patientId)) {
			throw new DomainException('DEBT_AGREEMENT_PATIENT_ID_REQUIRED');
		}
		if (!(props.totalAmount instanceof MoneyVo)) {
			throw new DomainException('DEBT_AGREEMENT_TOTAL_AMOUNT_REQUIRED');
		}
		if (!props.totalAmount.isPositive()) {
			throw new DomainException('DEBT_AGREEMENT_TOTAL_AMOUNT_MUST_BE_POSITIVE');
		}
		if (
			!Number.isInteger(props.installmentsCount) ||
			props.installmentsCount <= 0
		) {
			throw new DomainException(
				'DEBT_AGREEMENT_INSTALLMENTS_COUNT_MUST_BE_POSITIVE_INTEGER',
			);
		}
		if (!Object.values(EDebtAgreementStatus).includes(props.status)) {
			throw new DomainException('INVALID_DEBT_AGREEMENT_STATUS');
		}
	}
}
