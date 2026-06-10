import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Allow } from 'class-validator';

export class GetDebtAgreementQueryDto {
	@ApiProperty({
		format: 'uuid',
	})
	@Allow()
	clinicId!: string;

	@ApiPropertyOptional({
		type: String,
		format: 'date-time',
	})
	@Allow()
	@Transform(({ value }) => (value === undefined ? value : new Date(value)))
	referenceDate?: Date;
}
