import { ValueObject } from './value-object';

import { DomainException } from '@/@core/domain/exceptions/domain-exception';

export type Currency = 'BRL';

export type MoneyProps = {
	cents: number;
	currency: Currency;
};

export type MoneyInput = {
	cents: number;
	currency?: Currency;
};

export class MoneyVo extends ValueObject<MoneyProps> {
	private constructor(props: MoneyProps) {
		super(props);
	}

	static zero(currency: Currency = 'BRL'): MoneyVo {
		return new MoneyVo({ cents: 0, currency });
	}

	static fromCents(cents: number, currency: Currency = 'BRL'): MoneyVo {
		return new MoneyVo({ cents, currency });
	}

	static fromDecimal(value: string, currency: Currency = 'BRL'): MoneyVo {
		const normalized = value.trim().replace(',', '.');
		if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
			throw new DomainException('INVALID_MONEY_DECIMAL_VALUE');
		}
		const [integerPart, decimalPart = ''] = normalized.split('.');
		const cents =
			Number(integerPart) * 100 + Number(decimalPart.padEnd(2, '0'));
		return new MoneyVo({ cents, currency });
	}

	getCents(): number {
		return this.props.cents;
	}

	getCurrency(): Currency {
		return this.props.currency;
	}

	isZero(): boolean {
		return this.props.cents === 0;
	}

	isPositive(): boolean {
		return this.props.cents > 0;
	}

	isGreaterThan(other: MoneyVo): boolean {
		this.ensureSameCurrency(other);
		return this.props.cents > other.getCents();
	}

	isGreaterThanOrEqual(other: MoneyVo): boolean {
		this.ensureSameCurrency(other);
		return this.props.cents >= other.getCents();
	}

	isLessThan(other: MoneyVo): boolean {
		this.ensureSameCurrency(other);
		return this.props.cents < other.getCents();
	}

	isLessThanOrEqual(other: MoneyVo): boolean {
		this.ensureSameCurrency(other);
		return this.props.cents <= other.getCents();
	}

	add(other: MoneyVo): MoneyVo {
		this.ensureSameCurrency(other);
		return new MoneyVo({
			cents: this.props.cents + other.getCents(),
			currency: this.props.currency,
		});
	}

	subtract(other: MoneyVo): MoneyVo {
		this.ensureSameCurrency(other);
		const result = this.props.cents - other.getCents();
		if (result < 0) {
			throw new DomainException('MONEY_RESULT_CANNOT_BE_NEGATIVE');
		}
		return new MoneyVo({
			cents: result,
			currency: this.props.currency,
		});
	}

	multiply(multiplier: number): MoneyVo {
		if (!Number.isInteger(multiplier) || multiplier < 0) {
			throw new DomainException('INVALID_MONEY_MULTIPLIER');
		}
		return new MoneyVo({
			cents: this.props.cents * multiplier,
			currency: this.props.currency,
		});
	}

	override equals(other?: MoneyVo): boolean {
		if (!other) return false;
		return (
			this.props.cents === other.getCents() &&
			this.props.currency === other.getCurrency()
		);
	}

	splitEqually(parts: number): MoneyVo[] {
		if (!Number.isInteger(parts) || parts <= 0) {
			throw new DomainException('INVALID_SPLIT_PARTS');
		}
		const baseAmount = Math.floor(this.props.cents / parts);
		const remainder = this.props.cents % parts;
		return Array.from({ length: parts }, (_, index) => {
			const extraCent = index < remainder ? 1 : 0;
			return new MoneyVo({
				cents: baseAmount + extraCent,
				currency: this.props.currency,
			});
		});
	}

	format(locale = 'pt-BR'): string {
		return new Intl.NumberFormat(locale, {
			style: 'currency',
			currency: this.props.currency,
		}).format(this.props.cents / 100);
	}

	override unpack(): Readonly<MoneyProps> {
		return Object.freeze({
			cents: this.props.cents,
			currency: this.props.currency,
		});
	}

	toJSON(): MoneyProps {
		return this.unpack();
	}

	protected validate(props: MoneyProps): void {
		this.ensureValidCents(props.cents);
		this.ensureValidCurrency(props.currency);
	}

	private ensureValidCents(cents: number): void {
		if (!Number.isInteger(cents)) {
			throw new DomainException('MONEY_CENTS_MUST_BE_INTEGER');
		}
		if (cents < 0) {
			throw new DomainException('MONEY_CENTS_CANNOT_BE_NEGATIVE');
		}
		if (!Number.isSafeInteger(cents)) {
			throw new DomainException('MONEY_CENTS_MUST_BE_SAFE_INTEGER');
		}
	}

	private ensureValidCurrency(currency: Currency): void {
		if (currency !== 'BRL') {
			throw new DomainException('INVALID_MONEY_CURRENCY');
		}
	}

	private ensureSameCurrency(other: MoneyVo): void {
		if (this.props.currency !== other.getCurrency()) {
			throw new DomainException('MONEY_CURRENCY_MISMATCH');
		}
	}
}
