import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { EPaymentMethod } from '@/@core/enums/domain';

type PaymentIdempotencyPayload = {
	clinicId: string;
	installmentId: string;
	amountCents: number;
	method: EPaymentMethod;
	externalReference: string | null;
	paidAt: Date;
};

@Injectable()
export class PaymentIdempotencyPayloadHasherService {
	hash(input: PaymentIdempotencyPayload): string {
		return createHash('sha256')
			.update(
				JSON.stringify({
					clinicId: input.clinicId,
					installmentId: input.installmentId,
					amountCents: input.amountCents,
					method: input.method,
					externalReference: input.externalReference,
					paidAt: input.paidAt.toISOString(),
				}),
			)
			.digest('hex');
	}
}
