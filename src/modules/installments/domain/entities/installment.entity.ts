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
import { EInstallmentStatus } from '@/@core/enums/domain';

import { ensureValidDate } from '@/shared/utils/ensure-valid-date';

type InstallmentEntityProps = {
	clinicId: EntityId;
	debtAgreementId: EntityId;
	installmentNumber: number;
	dueDate: Date;
	amount: MoneyVo;
	paidAmount: MoneyVo;
	status: EInstallmentStatus;
	paidAt: Date | null;
	version: number;
};

type InstallmentEntityConstructor = CreateEntityProps<InstallmentEntityProps>;

export class InstallmentEntity extends UpdatableEntity<InstallmentEntityProps> {
	private constructor(props: InstallmentEntityConstructor) {
		InstallmentEntity.validateProps(props.props);
		super(props);
	}

	static create(props: InstallmentEntityProps): InstallmentEntity {
		return new InstallmentEntity({
			id: EntityUuid.create(),
			props,
		});
	}

	static createFrom(
		id: EntityId,
		props: InstallmentEntityProps,
		meta?: EntityMeta,
	): InstallmentEntity {
		return new InstallmentEntity({
			id,
			props,
			meta,
		});
	}

	registerPayment(amount: MoneyVo, paidAt: Date): void {
		if (!(amount instanceof MoneyVo) || !amount.isPositive()) {
			throw new DomainException('INSTALLMENT_PAYMENT_AMOUNT_MUST_BE_POSITIVE');
		}
		if (!(paidAt instanceof Date) || Number.isNaN(paidAt.getTime())) {
			throw new DomainException('INSTALLMENT_PAYMENT_DATE_REQUIRED');
		}
		if (this.props.status === EInstallmentStatus.Paid) {
			throw new DomainException('PAID_INSTALLMENT_CANNOT_RECEIVE_PAYMENT');
		}
		if (this.props.status === EInstallmentStatus.Canceled) {
			throw new DomainException('CANCELED_INSTALLMENT_CANNOT_RECEIVE_PAYMENT');
		}

		const remainingAmount = this.getRemainingAmount();
		if (amount.isGreaterThan(remainingAmount)) {
			throw new DomainException('INSTALLMENT_PAYMENT_EXCEEDS_REMAINING_AMOUNT');
		}

		this.props.paidAmount = this.props.paidAmount.add(amount);
		this.props.version += 1;
		this.props.status = this.props.paidAmount.equals(this.props.amount)
			? EInstallmentStatus.Paid
			: EInstallmentStatus.PartiallyPaid;
		this.props.paidAt =
			this.props.status === EInstallmentStatus.Paid ? paidAt : null;
		this.touch();
	}

	getRemainingAmount(): MoneyVo {
		return this.props.amount.subtract(this.props.paidAmount);
	}

	isPaid(): boolean {
		return this.props.status === EInstallmentStatus.Paid;
	}

	isOverdue(referenceDate: Date): boolean {
		ensureValidDate(referenceDate, 'INSTALLMENT_REFERENCE_DATE_REQUIRED');
		return (
			!this.isPaid() &&
			InstallmentEntity.compareDateOnly(referenceDate, this.props.dueDate) > 0
		);
	}

	isDueToday(referenceDate: Date): boolean {
		ensureValidDate(referenceDate, 'INSTALLMENT_REFERENCE_DATE_REQUIRED');
		return (
			!this.isPaid() &&
			InstallmentEntity.compareDateOnly(referenceDate, this.props.dueDate) === 0
		);
	}

	getDaysOverdue(referenceDate: Date): number {
		ensureValidDate(referenceDate, 'INSTALLMENT_REFERENCE_DATE_REQUIRED');
		if (!this.isOverdue(referenceDate)) {
			return 0;
		}
		const reference = InstallmentEntity.toStartOfDay(referenceDate);
		const dueDate = InstallmentEntity.toStartOfDay(this.props.dueDate);
		const dayInMs = 24 * 60 * 60 * 1000;
		return Math.floor((reference.getTime() - dueDate.getTime()) / dayInMs);
	}

	get clinicId(): EntityId {
		return this.props.clinicId;
	}

	get debtAgreementId(): EntityId {
		return this.props.debtAgreementId;
	}

	get installmentNumber(): number {
		return this.props.installmentNumber;
	}

	get dueDate(): Date {
		return this.props.dueDate;
	}

	get amount(): MoneyVo {
		return this.props.amount;
	}

	get paidAmount(): MoneyVo {
		return this.props.paidAmount;
	}

	get status(): EInstallmentStatus {
		return this.props.status;
	}

	get paidAt(): Date | null {
		return this.props.paidAt;
	}

	get version(): number {
		return this.props.version;
	}

	private static validateProps(props: InstallmentEntityProps): void {
		if (Guard.isEmpty(props.clinicId)) {
			throw new DomainException('INSTALLMENT_CLINIC_ID_REQUIRED');
		}
		if (Guard.isEmpty(props.debtAgreementId)) {
			throw new DomainException('INSTALLMENT_DEBT_AGREEMENT_ID_REQUIRED');
		}
		if (
			!Number.isInteger(props.installmentNumber) ||
			props.installmentNumber <= 0
		) {
			throw new DomainException('INSTALLMENT_NUMBER_MUST_BE_POSITIVE_INTEGER');
		}
		ensureValidDate(props.dueDate, 'INSTALLMENT_DUE_DATE_REQUIRED');
		if (!(props.amount instanceof MoneyVo)) {
			throw new DomainException('INSTALLMENT_AMOUNT_REQUIRED');
		}
		if (!props.amount.isPositive()) {
			throw new DomainException('INSTALLMENT_AMOUNT_MUST_BE_POSITIVE');
		}
		if (!(props.paidAmount instanceof MoneyVo)) {
			throw new DomainException('INSTALLMENT_PAID_AMOUNT_REQUIRED');
		}
		if (props.paidAmount.getCurrency() !== props.amount.getCurrency()) {
			throw new DomainException('INSTALLMENT_AMOUNT_CURRENCY_MISMATCH');
		}
		if (props.paidAmount.getCents() < 0) {
			throw new DomainException('INSTALLMENT_PAID_AMOUNT_CANNOT_BE_NEGATIVE');
		}
		if (props.paidAmount.isGreaterThan(props.amount)) {
			throw new DomainException('INSTALLMENT_PAID_AMOUNT_CANNOT_EXCEED_AMOUNT');
		}
		if (!Object.values(EInstallmentStatus).includes(props.status)) {
			throw new DomainException('INVALID_INSTALLMENT_STATUS');
		}
		if (props.paidAt !== null) {
			ensureValidDate(props.paidAt, 'INSTALLMENT_PAID_AT_MUST_BE_VALID_DATE');
		}
		if (!Number.isInteger(props.version) || props.version < 0) {
			throw new DomainException(
				'INSTALLMENT_VERSION_MUST_BE_NON_NEGATIVE_INTEGER',
			);
		}
		if (props.status === EInstallmentStatus.Paid && props.paidAt === null) {
			throw new DomainException('PAID_INSTALLMENT_MUST_HAVE_PAID_AT');
		}
		if (
			props.status !== EInstallmentStatus.Paid &&
			props.paidAmount.equals(props.amount)
		) {
			throw new DomainException('FULLY_PAID_INSTALLMENT_MUST_HAVE_PAID_STATUS');
		}
		if (
			props.status === EInstallmentStatus.Pending &&
			props.paidAmount.isPositive()
		) {
			throw new DomainException('PENDING_INSTALLMENT_CANNOT_HAVE_PAID_AMOUNT');
		}
	}

	private static compareDateOnly(left: Date, right: Date): number {
		return (
			InstallmentEntity.toStartOfDay(left).getTime() -
			InstallmentEntity.toStartOfDay(right).getTime()
		);
	}

	private static toStartOfDay(date: Date): Date {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate());
	}
}
