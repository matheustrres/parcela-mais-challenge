import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsUUID, Min } from 'class-validator';

export class CreateDebtAgreementRequestDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	clinicId!: string;

	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	patientId!: string;

	@ApiProperty({ minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	totalAmountCents!: number;

	@ApiProperty({ minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	installmentsCount!: number;

	@ApiProperty({
		type: String,
		format: 'date-time',
	})
	@Type(() => Date)
	@IsDate()
	firstDueDate!: Date;
}
