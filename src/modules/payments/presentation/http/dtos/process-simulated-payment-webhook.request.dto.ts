import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsDate,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Min,
	registerDecorator,
	type ValidationArguments,
	type ValidationOptions,
} from 'class-validator';

import { EPaymentMethod } from '@/@core/enums/domain';

function IsSimulatedWebhookPaymentMethod(
	validationOptions?: ValidationOptions,
) {
	return (object: object, propertyName: string) => {
		registerDecorator({
			name: 'isSimulatedWebhookPaymentMethod',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			validator: {
				validate(value: unknown) {
					return (
						value === EPaymentMethod.Pix || value === EPaymentMethod.Boleto
					);
				},
				defaultMessage(args: ValidationArguments) {
					return `${args.property} must be one of: PIX, BOLETO`;
				},
			},
		});
	};
}

export class ProcessSimulatedPaymentWebhookRequestDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	clinicId!: string;

	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	installmentId!: string;

	@ApiProperty()
	@IsString()
	provider!: string;

	@ApiProperty()
	@IsString()
	eventId!: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	externalReference?: string | null;

	@ApiProperty({ minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	amountCents!: number;

	@ApiProperty({ enum: [EPaymentMethod.Pix, EPaymentMethod.Boleto] })
	@IsSimulatedWebhookPaymentMethod()
	method!: EPaymentMethod;

	@ApiProperty({
		type: String,
		format: 'date-time',
	})
	@Type(() => Date)
	@IsDate()
	paidAt!: Date;
}
