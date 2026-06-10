import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class ClinicScopedPaginationQueryDto {
	@ApiProperty({
		format: 'uuid',
	})
	@IsUUID()
	clinicId!: string;

	@ApiPropertyOptional({
		minimum: 1,
		default: 50,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	limit?: number;

	@ApiPropertyOptional({
		minimum: 0,
		default: 0,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	offset?: number;
}
