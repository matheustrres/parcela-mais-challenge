import { describe, expect, it, vi } from 'vitest';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { DomainException } from '@/@core/domain/exceptions/domain-exception';
import { EInstallmentStatus } from '@/@core/enums/domain';

import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { EDerivedInstallmentStatus } from '@/modules/installments/domain/enums/derived-status';

describe('InstallmentEntity', () => {
	const makeProps = () => ({
		clinicId: EntityUuid.createFrom('clinic-id'),
		debtAgreementId: EntityUuid.createFrom('agreement-id'),
		installmentNumber: 1,
		dueDate: new Date('2024-04-10T12:00:00.000Z'),
		amount: MoneyVo.fromCents(10_000),
		paidAmount: MoneyVo.zero(),
		status: EInstallmentStatus.Pending,
		paidAt: null,
		version: 0,
	});

	describe('.create', () => {
		it('should create installment with generated id', () => {
			const entity = InstallmentEntity.create(makeProps());
			expect(entity.id).toBeInstanceOf(EntityUuid);
			expect(entity.clinicId.toString()).toBe('clinic-id');
			expect(entity.debtAgreementId.toString()).toBe('agreement-id');
			expect(entity.installmentNumber).toBe(1);
			expect(entity.amount.getCents()).toBe(10_000);
			expect(entity.paidAmount.getCents()).toBe(0);
			expect(entity.status).toBe(EInstallmentStatus.Pending);
			expect(entity.version).toBe(0);
		});

		it('should reject invalid installment number', () => {
			expect(() =>
				InstallmentEntity.create({
					...makeProps(),
					installmentNumber: 0,
				}),
			).toThrowError(
				new DomainException('INSTALLMENT_NUMBER_MUST_BE_POSITIVE_INTEGER'),
			);
		});

		it('should reject non-positive amount', () => {
			expect(() =>
				InstallmentEntity.create({
					...makeProps(),
					amount: MoneyVo.zero(),
				}),
			).toThrowError(
				new DomainException('INSTALLMENT_AMOUNT_MUST_BE_POSITIVE'),
			);
		});

		it('should reject paid amount above total amount', () => {
			expect(() =>
				InstallmentEntity.create({
					...makeProps(),
					paidAmount: MoneyVo.fromCents(10_001),
				}),
			).toThrowError(
				new DomainException('INSTALLMENT_PAID_AMOUNT_CANNOT_EXCEED_AMOUNT'),
			);
		});

		it('should reject paid status without paidAt', () => {
			expect(() =>
				InstallmentEntity.create({
					...makeProps(),
					paidAmount: MoneyVo.fromCents(10_000),
					status: EInstallmentStatus.Paid,
					paidAt: null,
				}),
			).toThrowError(new DomainException('PAID_INSTALLMENT_MUST_HAVE_PAID_AT'));
		});
	});

	describe('.createFrom', () => {
		it('should create installment with provided id and meta', () => {
			const id = EntityUuid.createFrom('installment-id');
			const createdAt = new Date('2024-04-01T10:00:00.000Z');
			const updatedAt = new Date('2024-04-02T10:00:00.000Z');
			const entity = InstallmentEntity.createFrom(id, makeProps(), {
				createdAt,
				updatedAt,
			});
			expect(entity.id.toString()).toBe('installment-id');
			expect(entity.createdAt).toBe(createdAt);
			expect(entity.updatedAt).toBe(updatedAt);
		});
	});

	describe('.registerPayment', () => {
		it('should register partial payment update status version and updatedAt', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2024-04-03T10:00:00.000Z'));
			const entity = InstallmentEntity.create(makeProps());
			entity.registerPayment(
				MoneyVo.fromCents(4_000),
				new Date('2024-04-03T09:00:00.000Z'),
			);
			expect(entity.paidAmount.getCents()).toBe(4_000);
			expect(entity.getRemainingAmount().getCents()).toBe(6_000);
			expect(entity.status).toBe(EInstallmentStatus.PartiallyPaid);
			expect(entity.paidAt).toBeNull();
			expect(entity.version).toBe(1);
			expect(entity.updatedAt).toEqual(new Date('2024-04-03T10:00:00.000Z'));
			vi.useRealTimers();
		});

		it('should register final payment and mark installment as paid', () => {
			const entity = InstallmentEntity.create({
				...makeProps(),
				paidAmount: MoneyVo.fromCents(4_000),
				status: EInstallmentStatus.PartiallyPaid,
				version: 1,
			});
			const paidAt = new Date('2024-04-04T10:00:00.000Z');
			entity.registerPayment(MoneyVo.fromCents(6_000), paidAt);
			expect(entity.paidAmount.getCents()).toBe(10_000);
			expect(entity.status).toBe(EInstallmentStatus.Paid);
			expect(entity.paidAt).toEqual(paidAt);
			expect(entity.isPaid()).toBe(true);
			expect(entity.version).toBe(2);
		});

		it('should reject payment above remaining amount', () => {
			const entity = InstallmentEntity.create(makeProps());
			expect(() =>
				entity.registerPayment(
					MoneyVo.fromCents(10_001),
					new Date('2024-04-03T09:00:00.000Z'),
				),
			).toThrowError(
				new DomainException('INSTALLMENT_PAYMENT_EXCEEDS_REMAINING_AMOUNT'),
			);
		});

		it('should reject non-positive payment amount', () => {
			const entity = InstallmentEntity.create(makeProps());
			expect(() =>
				entity.registerPayment(
					MoneyVo.zero(),
					new Date('2024-04-03T09:00:00.000Z'),
				),
			).toThrowError(
				new DomainException('INSTALLMENT_PAYMENT_AMOUNT_MUST_BE_POSITIVE'),
			);
		});

		it('should reject payment on paid installment', () => {
			const entity = InstallmentEntity.create({
				...makeProps(),
				paidAmount: MoneyVo.fromCents(10_000),
				status: EInstallmentStatus.Paid,
				paidAt: new Date('2024-04-02T10:00:00.000Z'),
			});
			expect(() =>
				entity.registerPayment(
					MoneyVo.fromCents(100),
					new Date('2024-04-03T09:00:00.000Z'),
				),
			).toThrowError(
				new DomainException('PAID_INSTALLMENT_CANNOT_RECEIVE_PAYMENT'),
			);
		});
	});

	describe('.getRemainingAmount', () => {
		it('should return amount minus paid amount', () => {
			const entity = InstallmentEntity.create({
				...makeProps(),
				paidAmount: MoneyVo.fromCents(2_500),
				status: EInstallmentStatus.PartiallyPaid,
			});
			expect(entity.getRemainingAmount().getCents()).toBe(7_500);
		});
	});

	describe('.isPaid', () => {
		it('should return true when status is paid', () => {
			expect(
				InstallmentEntity.create({
					...makeProps(),
					paidAmount: MoneyVo.fromCents(10_000),
					status: EInstallmentStatus.Paid,
					paidAt: new Date('2024-04-02T10:00:00.000Z'),
				}).isPaid(),
			).toBe(true);
		});
	});

	describe('.isCanceled', () => {
		it('should return true when status is canceled', () => {
			expect(
				InstallmentEntity.create({
					...makeProps(),
					status: EInstallmentStatus.Canceled,
				}).isCanceled(),
			).toBe(true);
		});
	});

	describe('.isOverdue', () => {
		it('should return true when unpaid installment due date is before reference date', () => {
			const entity = InstallmentEntity.create(makeProps());
			expect(entity.isOverdue(new Date('2024-04-11T08:00:00.000Z'))).toBe(true);
		});

		it('should return false when installment is paid', () => {
			const entity = InstallmentEntity.create({
				...makeProps(),
				paidAmount: MoneyVo.fromCents(10_000),
				status: EInstallmentStatus.Paid,
				paidAt: new Date('2024-04-09T10:00:00.000Z'),
			});
			expect(entity.isOverdue(new Date('2024-04-11T08:00:00.000Z'))).toBe(
				false,
			);
		});
	});

	describe('.isDueToday', () => {
		it('should return true when unpaid installment due date matches reference date', () => {
			const entity = InstallmentEntity.create(makeProps());
			expect(entity.isDueToday(new Date('2024-04-10T23:59:00.000Z'))).toBe(
				true,
			);
		});
	});

	describe('.getDaysOverdue', () => {
		it('should return overdue days count based on date only', () => {
			const entity = InstallmentEntity.create(makeProps());
			expect(entity.getDaysOverdue(new Date('2024-04-15T08:00:00.000Z'))).toBe(
				5,
			);
		});

		it('should return zero when installment is not overdue', () => {
			const entity = InstallmentEntity.create(makeProps());
			expect(entity.getDaysOverdue(new Date('2024-04-10T08:00:00.000Z'))).toBe(
				0,
			);
		});
	});

	describe('.getDerivedStatus', () => {
		it('should return canceled when installment is canceled', () => {
			const entity = InstallmentEntity.create({
				...makeProps(),
				status: EInstallmentStatus.Canceled,
			});
			expect(
				entity.getDerivedStatus(new Date('2024-04-11T08:00:00.000Z')),
			).toBe(EDerivedInstallmentStatus.Canceled);
		});

		it('should return paid when installment is paid', () => {
			const entity = InstallmentEntity.create({
				...makeProps(),
				paidAmount: MoneyVo.fromCents(10_000),
				status: EInstallmentStatus.Paid,
				paidAt: new Date('2024-04-09T10:00:00.000Z'),
			});
			expect(
				entity.getDerivedStatus(new Date('2024-04-11T08:00:00.000Z')),
			).toBe(EDerivedInstallmentStatus.Paid);
		});

		it('should return overdue when pending installment is overdue', () => {
			const entity = InstallmentEntity.create(makeProps());
			expect(
				entity.getDerivedStatus(new Date('2024-04-11T08:00:00.000Z')),
			).toBe(EDerivedInstallmentStatus.Overdue);
		});

		it('should return overdue when partially paid installment is overdue', () => {
			const entity = InstallmentEntity.create({
				...makeProps(),
				paidAmount: MoneyVo.fromCents(2_500),
				status: EInstallmentStatus.PartiallyPaid,
			});
			expect(
				entity.getDerivedStatus(new Date('2024-04-11T08:00:00.000Z')),
			).toBe(EDerivedInstallmentStatus.Overdue);
		});

		it('should return due today when pending installment is due today', () => {
			const entity = InstallmentEntity.create(makeProps());
			expect(
				entity.getDerivedStatus(new Date('2024-04-10T23:59:00.000Z')),
			).toBe(EDerivedInstallmentStatus.DueToday);
		});

		it('should return due today when partially paid installment is due today', () => {
			const entity = InstallmentEntity.create({
				...makeProps(),
				paidAmount: MoneyVo.fromCents(2_500),
				status: EInstallmentStatus.PartiallyPaid,
			});
			expect(
				entity.getDerivedStatus(new Date('2024-04-10T23:59:00.000Z')),
			).toBe(EDerivedInstallmentStatus.DueToday);
		});

		it('should return partially paid when installment is partially paid and not due yet', () => {
			const entity = InstallmentEntity.create({
				...makeProps(),
				paidAmount: MoneyVo.fromCents(2_500),
				status: EInstallmentStatus.PartiallyPaid,
			});
			expect(
				entity.getDerivedStatus(new Date('2024-04-09T08:00:00.000Z')),
			).toBe(EDerivedInstallmentStatus.PartiallyPaid);
		});

		it('should return pending when installment is pending and not due yet', () => {
			const entity = InstallmentEntity.create(makeProps());
			expect(
				entity.getDerivedStatus(new Date('2024-04-09T08:00:00.000Z')),
			).toBe(EDerivedInstallmentStatus.Pending);
		});
	});
});
