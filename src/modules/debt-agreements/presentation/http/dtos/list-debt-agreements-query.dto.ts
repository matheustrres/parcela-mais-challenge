import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Allow } from 'class-validator';

import { EDebtAgreementStatus } from '@/@core/enums/domain';

export class ListDebtAgreementsQueryDto {
	@ApiProperty({
		format: 'uuid',
	})
	@Allow()
	clinicId!: string;

	@ApiPropertyOptional({
		format: 'uuid',
	})
	@Allow()
	patientId?: string;

	@ApiPropertyOptional({
		enum: EDebtAgreementStatus,
	})
	@Allow()
	status?: string;

	@ApiPropertyOptional({
		type: String,
		format: 'date-time',
		description:
			'Optional reference date used to calculate overdue installments. Defaults to current server time.',
	})
	@Allow()
	@Transform(({ value }) => (value === undefined ? value : new Date(value)))
	referenceDate?: Date;

	@ApiPropertyOptional({
		minimum: 1,
		default: 50,
	})
	@Allow()
	@Transform(({ value }) => (value === undefined ? value : Number(value)))
	limit?: number;

	@ApiPropertyOptional({
		minimum: 0,
		default: 0,
	})
	@Allow()
	@Transform(({ value }) => (value === undefined ? value : Number(value)))
	offset?: number;
}
