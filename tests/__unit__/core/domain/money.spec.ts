import { describe, expect, it } from 'vitest';

import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { DomainException } from '@/@core/domain/exceptions/domain-exception';

describe('MoneyVo', () => {
	describe('.zero', () => {
		it('should create zero money with BRL by default', () => {
			const money = MoneyVo.zero();
			expect(money.getCents()).toBe(0);
			expect(money.getCurrency()).toBe('BRL');
		});
	});

	describe('.fromCents', () => {
		it('should create money from integer cents', () => {
			expect(MoneyVo.fromCents(1234).getCents()).toBe(1234);
		});

		it('should reject non-integer cents', () => {
			expect(() => MoneyVo.fromCents(1.5)).toThrowError(
				new DomainException('MONEY_CENTS_MUST_BE_INTEGER'),
			);
		});

		it('should reject negative cents', () => {
			expect(() => MoneyVo.fromCents(-1)).toThrowError(
				new DomainException('MONEY_CENTS_CANNOT_BE_NEGATIVE'),
			);
		});

		it('should reject unsafe integer cents', () => {
			expect(() => MoneyVo.fromCents(Number.MAX_SAFE_INTEGER + 1)).toThrowError(
				new DomainException('MONEY_CENTS_MUST_BE_SAFE_INTEGER'),
			);
		});

		it('should reject invalid currency values', () => {
			expect(() => MoneyVo.fromCents(100, 'USD' as never)).toThrowError(
				new DomainException('INVALID_MONEY_CURRENCY'),
			);
		});
	});

	describe('.fromDecimal', () => {
		it('should create money from normalized decimal strings', () => {
			expect(MoneyVo.fromDecimal('12.34').getCents()).toBe(1234);
			expect(MoneyVo.fromDecimal('12,3').getCents()).toBe(1230);
			expect(MoneyVo.fromDecimal(' 12 ').getCents()).toBe(1200);
		});

		it('should reject invalid decimal strings', () => {
			expect(() => MoneyVo.fromDecimal('12.345')).toThrowError(
				new DomainException('INVALID_MONEY_DECIMAL_VALUE'),
			);
			expect(() => MoneyVo.fromDecimal('-1')).toThrowError(
				new DomainException('INVALID_MONEY_DECIMAL_VALUE'),
			);
			expect(() => MoneyVo.fromDecimal('abc')).toThrowError(
				new DomainException('INVALID_MONEY_DECIMAL_VALUE'),
			);
		});
	});

	describe('.getCents', () => {
		it('should return current cents value', () => {
			expect(MoneyVo.fromCents(1234).getCents()).toBe(1234);
		});
	});

	describe('.getCurrency', () => {
		it('should return current currency', () => {
			expect(MoneyVo.fromCents(1234).getCurrency()).toBe('BRL');
		});
	});

	describe('.isZero', () => {
		it('should return true when cents are zero', () => {
			expect(MoneyVo.zero().isZero()).toBe(true);
		});
	});

	describe('.isPositive', () => {
		it('should return false when cents are zero', () => {
			expect(MoneyVo.zero().isPositive()).toBe(false);
		});

		it('should return true when cents are greater than zero', () => {
			expect(MoneyVo.fromCents(1).isPositive()).toBe(true);
		});
	});

	describe('.isGreaterThan', () => {
		it('should return true when current value is greater', () => {
			expect(MoneyVo.fromCents(200).isGreaterThan(MoneyVo.fromCents(100))).toBe(
				true,
			);
		});

		it('should reject comparisons with different currencies', () => {
			const brl = MoneyVo.fromCents(100);
			const fakeUsd = {
				getCents: () => 100,
				getCurrency: () => 'USD',
			} as unknown as MoneyVo;
			expect(() => brl.isGreaterThan(fakeUsd)).toThrowError(
				new DomainException('MONEY_CURRENCY_MISMATCH'),
			);
		});
	});

	describe('.isGreaterThanOrEqual', () => {
		it('should return true when values are equal', () => {
			expect(
				MoneyVo.fromCents(100).isGreaterThanOrEqual(MoneyVo.fromCents(100)),
			).toBe(true);
		});
	});

	describe('.isLessThan', () => {
		it('should return true when current value is lower', () => {
			expect(MoneyVo.fromCents(100).isLessThan(MoneyVo.fromCents(200))).toBe(
				true,
			);
		});
	});

	describe('.isLessThanOrEqual', () => {
		it('should return true when values are equal', () => {
			expect(
				MoneyVo.fromCents(100).isLessThanOrEqual(MoneyVo.fromCents(100)),
			).toBe(true);
		});
	});

	describe('.add', () => {
		it('should add values preserving currency', () => {
			expect(
				MoneyVo.fromCents(500).add(MoneyVo.fromCents(250)).unpack(),
			).toEqual({ cents: 750, currency: 'BRL' });
		});

		it('should reject sums with different currencies', () => {
			const brl = MoneyVo.fromCents(100);
			const fakeUsd = {
				getCents: () => 100,
				getCurrency: () => 'USD',
			} as unknown as MoneyVo;
			expect(() => brl.add(fakeUsd)).toThrowError(
				new DomainException('MONEY_CURRENCY_MISMATCH'),
			);
		});
	});

	describe('.subtract', () => {
		it('should subtract values preserving currency', () => {
			expect(
				MoneyVo.fromCents(500).subtract(MoneyVo.fromCents(250)).unpack(),
			).toEqual({
				cents: 250,
				currency: 'BRL',
			});
		});

		it('should reject negative subtraction results', () => {
			expect(() =>
				MoneyVo.fromCents(100).subtract(MoneyVo.fromCents(101)),
			).toThrowError(new DomainException('MONEY_RESULT_CANNOT_BE_NEGATIVE'));
		});

		it('should reject subtraction with different currencies', () => {
			const brl = MoneyVo.fromCents(100);
			const fakeUsd = {
				getCents: () => 100,
				getCurrency: () => 'USD',
			} as unknown as MoneyVo;
			expect(() => brl.subtract(fakeUsd)).toThrowError(
				new DomainException('MONEY_CURRENCY_MISMATCH'),
			);
		});
	});

	describe('.multiply', () => {
		it('should multiply cents by an integer factor', () => {
			expect(MoneyVo.fromCents(250).multiply(3).unpack()).toEqual({
				cents: 750,
				currency: 'BRL',
			});
		});

		it('should reject negative multipliers', () => {
			expect(() => MoneyVo.fromCents(100).multiply(-1)).toThrowError(
				new DomainException('INVALID_MONEY_MULTIPLIER'),
			);
		});

		it('should reject non-integer multipliers', () => {
			expect(() => MoneyVo.fromCents(100).multiply(1.5)).toThrowError(
				new DomainException('INVALID_MONEY_MULTIPLIER'),
			);
		});
	});

	describe('.equals', () => {
		it('should return true for same cents and currency', () => {
			expect(MoneyVo.fromCents(100).equals(MoneyVo.fromCents(100))).toBe(true);
		});

		it('should return false for different values', () => {
			expect(MoneyVo.fromCents(100).equals(MoneyVo.fromCents(200))).toBe(false);
		});

		it('should return false when other value is undefined', () => {
			expect(MoneyVo.fromCents(100).equals()).toBe(false);
		});
	});

	describe('.splitEqually', () => {
		it('should split value distributing remainder to first parts', () => {
			const result = MoneyVo.fromCents(10).splitEqually(3);
			expect(result.map((money) => money.unpack())).toEqual([
				{ cents: 4, currency: 'BRL' },
				{ cents: 3, currency: 'BRL' },
				{ cents: 3, currency: 'BRL' },
			]);
		});

		it('should reject zero parts', () => {
			expect(() => MoneyVo.fromCents(10).splitEqually(0)).toThrowError(
				new DomainException('INVALID_SPLIT_PARTS'),
			);
		});

		it('should reject non-integer parts', () => {
			expect(() => MoneyVo.fromCents(10).splitEqually(1.5)).toThrowError(
				new DomainException('INVALID_SPLIT_PARTS'),
			);
		});
	});

	describe('.format', () => {
		it('should format money using pt-BR currency rules by default', () => {
			expect(MoneyVo.fromCents(1234).format()).toBe('R$\u00a012,34');
		});
	});

	describe('.unpack', () => {
		it('should return frozen props object', () => {
			const unpacked = MoneyVo.fromCents(1234).unpack();
			expect(unpacked).toEqual({ cents: 1234, currency: 'BRL' });
			expect(Object.isFrozen(unpacked)).toBe(true);
		});
	});

	describe('.toJSON', () => {
		it('should serialize money props', () => {
			expect(MoneyVo.fromCents(1234).toJSON()).toEqual({
				cents: 1234,
				currency: 'BRL',
			});
		});
	});
});
