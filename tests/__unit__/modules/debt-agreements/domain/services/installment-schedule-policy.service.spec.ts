import { describe, expect, it } from 'vitest';

import { DomainException } from '@/@core/domain/exceptions/domain-exception';

import { InstallmentSchedulePolicyDomainService } from '@/modules/debt-agreements/domain/services/installment-schedule-policy.service';

describe('InstallmentSchedulePolicyDomainService', () => {
	const service = new InstallmentSchedulePolicyDomainService();

	it('should preserve first due date as the first installment', () => {
		const firstDueDate = new Date('2026-01-15T12:00:00.000Z');
		const dueDates = service.generateDueDates({
			firstDueDate,
			installmentsCount: 3,
		});
		expect(dueDates[0]?.toISOString()).toBe(firstDueDate.toISOString());
	});

	it('should anchor due dates to the original calendar day with end-of-month adjustment', () => {
		const dueDates = service.generateDueDates({
			firstDueDate: new Date(2026, 0, 31, 9, 30, 0, 0),
			installmentsCount: 5,
		});
		expect(
			dueDates.map((date) => ({
				year: date.getFullYear(),
				month: date.getMonth(),
				day: date.getDate(),
			})),
		).toEqual([
			{ year: 2026, month: 0, day: 31 },
			{ year: 2026, month: 1, day: 28 },
			{ year: 2026, month: 2, day: 31 },
			{ year: 2026, month: 3, day: 30 },
			{ year: 2026, month: 4, day: 31 },
		]);
	});

	it('should not drift after short months', () => {
		const dueDates = service.generateDueDates({
			firstDueDate: new Date(2026, 0, 31, 9, 30, 0, 0),
			installmentsCount: 14,
		});
		expect(dueDates[13]?.getDate()).toBe(28);
		expect(dueDates[13]?.getMonth()).toBe(1);
		expect(dueDates[13]?.getFullYear()).toBe(2027);
	});

	it('should reject invalid first due date', () => {
		expect(() =>
			service.generateDueDates({
				firstDueDate: new Date('invalid'),
				installmentsCount: 2,
			}),
		).toThrowError(
			new DomainException('INSTALLMENT_SCHEDULE_FIRST_DUE_DATE_REQUIRED'),
		);
	});

	it('should reject non-positive installments count', () => {
		expect(() =>
			service.generateDueDates({
				firstDueDate: new Date('2026-01-15T12:00:00.000Z'),
				installmentsCount: 0,
			}),
		).toThrowError(
			new DomainException(
				'INSTALLMENT_SCHEDULE_COUNT_MUST_BE_POSITIVE_INTEGER',
			),
		);
	});
});
