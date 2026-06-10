import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsDate,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Min,
} from 'class-validator';

import { EPaymentMethod } from '@/@core/enums/domain';

export class RegisterPaymentRequestDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	clinicId!: string;

	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	installmentId!: string;

	@ApiProperty({ minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	amountCents!: number;

	@ApiProperty({
		enum: EPaymentMethod,
	})
	@IsEnum(EPaymentMethod)
	method!: EPaymentMethod;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	externalReference?: string | null;

	@ApiProperty()
	@IsString()
	idempotencyKey!: string;

	@ApiProperty({
		type: String,
		format: 'date-time',
	})
	@Type(() => Date)
	@IsDate()
	paidAt!: Date;
}
