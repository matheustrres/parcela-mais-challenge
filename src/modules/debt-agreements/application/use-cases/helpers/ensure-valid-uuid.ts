import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ensureValidUuid(value: string, errorCode: string): EntityUuid {
	if (!UUID_PATTERN.test(value)) {
		throw new ApplicationException(errorCode);
	}
	return EntityUuid.createFrom(value);
}

export function ensureValidOptionalUuid(
	value: string | undefined,
	errorCode: string,
): EntityUuid | undefined {
	if (value === undefined) {
		return undefined;
	}
	return ensureValidUuid(value, errorCode);
}
