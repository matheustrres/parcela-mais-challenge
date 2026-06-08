import { describe, expect, it } from 'vitest';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';

describe('ApplicationException', () => {
	it('should keep code and statusCode', () => {
		const exception = new ApplicationException('CLINIC_NOT_FOUND', 404);

		expect(exception.code).toBe('CLINIC_NOT_FOUND');
		expect(exception.statusCode).toBe(404);
		expect(exception.message).toBe('CLINIC_NOT_FOUND');
		expect(exception.name).toBe('ApplicationException');
	});

	it('should allow a custom message', () => {
		const exception = new ApplicationException(
			'PATIENT_DOES_NOT_BELONG_TO_CLINIC',
			422,
			'Patient does not belong to clinic',
		);

		expect(exception.code).toBe('PATIENT_DOES_NOT_BELONG_TO_CLINIC');
		expect(exception.statusCode).toBe(422);
		expect(exception.message).toBe('Patient does not belong to clinic');
	});
});
