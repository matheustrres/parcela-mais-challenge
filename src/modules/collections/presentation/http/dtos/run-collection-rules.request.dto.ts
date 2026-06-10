import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsUUID } from 'class-validator';

export class RunCollectionRulesRequestDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	clinicId!: string;

	@ApiProperty({
		type: String,
		format: 'date-time',
	})
	@Type(() => Date)
	@IsDate()
	referenceDate!: Date;
}
