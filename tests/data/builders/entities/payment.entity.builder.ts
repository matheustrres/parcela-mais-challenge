import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { EPaymentMethod } from '@/@core/enums/domain';

import { PaymentEntity } from '@/modules/payments/domain/entities/payment.entity';

type BuildPaymentEntityOverrides = {
	id?: string;
	clinicId?: string;
	installmentId?: string;
	amountCents?: number;
	method?: EPaymentMethod;
	externalReference?: string | null;
	idempotencyKey?: string;
	idempotencyPayloadHash?: string;
	paidAt?: Date;
};

export function buildPaymentEntity(
	overrides: BuildPaymentEntityOverrides = {},
): PaymentEntity {
	return PaymentEntity.createFrom(
		EntityUuid.createFrom(overrides.id ?? 'payment-1'),
		{
			clinicId: EntityUuid.createFrom(overrides.clinicId ?? 'clinic-1'),
			installmentId: EntityUuid.createFrom(
				overrides.installmentId ?? 'installment-1',
			),
			amount: MoneyVo.fromCents(overrides.amountCents ?? 1_000),
			method: overrides.method ?? EPaymentMethod.Pix,
			externalReference: overrides.externalReference ?? 'external-ref-1',
			idempotencyKey: overrides.idempotencyKey ?? 'idem-1',
			idempotencyPayloadHash: overrides.idempotencyPayloadHash ?? 'hash-1',
			paidAt: overrides.paidAt ?? new Date('2026-01-12T12:00:00.000Z'),
		},
	);
}
