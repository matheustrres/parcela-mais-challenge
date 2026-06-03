import { describe, expect, it, vi } from 'vitest';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { DomainException } from '@/@core/domain/exceptions/domain-exception';
import { EDebtAgreementStatus } from '@/@core/enums/domain';

import { DebtAgreementEntity } from '@/modules/debt-agreements/domain/entities/debt-agreement.entity';

describe('DebtAgreementEntity', () => {
	const makeProps = () => ({
		clinicId: EntityUuid.createFrom('clinic-id'),
		patientId: EntityUuid.createFrom('patient-id'),
		totalAmount: MoneyVo.fromCents(10_000),
		installmentsCount: 10,
		status: EDebtAgreementStatus.Active,
	});

	describe('.create', () => {
		it('should create debt agreement with generated id', () => {
			const entity = DebtAgreementEntity.create(makeProps());
			expect(entity.id).toBeInstanceOf(EntityUuid);
			expect(entity.clinicId.toString()).toBe('clinic-id');
			expect(entity.patientId.toString()).toBe('patient-id');
			expect(entity.totalAmount.getCents()).toBe(10_000);
			expect(entity.installmentsCount).toBe(10);
			expect(entity.status).toBe(EDebtAgreementStatus.Active);
			expect(entity.updatedAt).toBeNull();
		});

		it('should reject missing clinic id', () => {
			expect(() =>
				DebtAgreementEntity.create({
					...makeProps(),
					clinicId: null as never,
				}),
			).toThrowError(new DomainException('DEBT_AGREEMENT_CLINIC_ID_REQUIRED'));
		});

		it('should reject missing patient id', () => {
			expect(() =>
				DebtAgreementEntity.create({
					...makeProps(),
					patientId: null as never,
				}),
			).toThrowError(new DomainException('DEBT_AGREEMENT_PATIENT_ID_REQUIRED'));
		});

		it('should reject non-positive total amount', () => {
			expect(() =>
				DebtAgreementEntity.create({
					...makeProps(),
					totalAmount: MoneyVo.zero(),
				}),
			).toThrowError(
				new DomainException('DEBT_AGREEMENT_TOTAL_AMOUNT_MUST_BE_POSITIVE'),
			);
		});

		it('should reject invalid installments count', () => {
			expect(() =>
				DebtAgreementEntity.create({
					...makeProps(),
					installmentsCount: 0,
				}),
			).toThrowError(
				new DomainException(
					'DEBT_AGREEMENT_INSTALLMENTS_COUNT_MUST_BE_POSITIVE_INTEGER',
				),
			);
		});
	});

	describe('.createFrom', () => {
		it('should create debt agreement with provided id and meta', () => {
			const id = EntityUuid.createFrom('agreement-id');
			const createdAt = new Date('2024-03-01T10:00:00.000Z');
			const updatedAt = new Date('2024-03-02T10:00:00.000Z');
			const entity = DebtAgreementEntity.createFrom(id, makeProps(), {
				createdAt,
				updatedAt,
			});
			expect(entity.id.toString()).toBe('agreement-id');
			expect(entity.createdAt).toBe(createdAt);
			expect(entity.updatedAt).toBe(updatedAt);
		});
	});

	describe('.cancel', () => {
		it('should cancel active agreement and touch updatedAt', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2024-03-03T10:00:00.000Z'));
			const entity = DebtAgreementEntity.create(makeProps());
			entity.cancel();
			expect(entity.status).toBe(EDebtAgreementStatus.Canceled);
			expect(entity.updatedAt).toEqual(new Date('2024-03-03T10:00:00.000Z'));
			vi.useRealTimers();
		});

		it('should reject canceling paid agreement', () => {
			const entity = DebtAgreementEntity.create({
				...makeProps(),
				status: EDebtAgreementStatus.Paid,
			});
			expect(() => entity.cancel()).toThrowError(
				new DomainException('PAID_DEBT_AGREEMENT_CANNOT_BE_CANCELED'),
			);
		});
	});

	describe('.markAsPaid', () => {
		it('should mark active agreement as paid and touch updatedAt', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2024-03-04T10:00:00.000Z'));
			const entity = DebtAgreementEntity.create(makeProps());
			entity.markAsPaid();
			expect(entity.status).toBe(EDebtAgreementStatus.Paid);
			expect(entity.updatedAt).toEqual(new Date('2024-03-04T10:00:00.000Z'));
			vi.useRealTimers();
		});

		it('should reject paying canceled agreement', () => {
			const entity = DebtAgreementEntity.create({
				...makeProps(),
				status: EDebtAgreementStatus.Canceled,
			});
			expect(() => entity.markAsPaid()).toThrowError(
				new DomainException('CANCELED_DEBT_AGREEMENT_CANNOT_BE_PAID'),
			);
		});
	});

	describe('.isActive', () => {
		it('should return true when status is active', () => {
			expect(DebtAgreementEntity.create(makeProps()).isActive()).toBe(true);
		});

		it('should return false when status is not active', () => {
			expect(
				DebtAgreementEntity.create({
					...makeProps(),
					status: EDebtAgreementStatus.Paid,
				}).isActive(),
			).toBe(false);
		});
	});
});
