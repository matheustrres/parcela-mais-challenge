import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsUUID } from 'class-validator';

export class GetDashboardSummaryQueryDto {
	@ApiProperty({
		format: 'uuid',
	})
	@IsUUID()
	clinicId!: string;

	@ApiPropertyOptional({
		type: String,
		format: 'date-time',
		description:
			'Optional reference date used for deterministic operational calculations. Defaults to current server time.',
	})
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	referenceDate?: Date;
}
