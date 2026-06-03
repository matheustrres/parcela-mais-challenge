import { DomainException } from '@/@core/domain/exceptions/domain-exception';

export function ensureValidDate(value: Date, errorMessage: string): void {
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
		throw new DomainException(errorMessage);
	}
}
