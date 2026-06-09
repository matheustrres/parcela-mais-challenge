import { TransactionContext } from '@/@core/application/transaction-manager';
import { EntityId } from '@/@core/domain/entities/entity-id';

import { PaymentEntity } from '@/modules/payments/domain/entities/payment.entity';

export abstract class PaymentRepository {
	abstract findByClinicIdAndIdempotencyKey(
		clinicId: EntityId,
		idempotencyKey: string,
	): Promise<PaymentEntity | null>;
	abstract findByClinicIdAndExternalReference(
		clinicId: EntityId,
		externalReference: string,
	): Promise<PaymentEntity | null>;
	abstract create(
		payment: PaymentEntity,
		tx?: TransactionContext,
	): Promise<void>;
	abstract findByClinicIdAndInstallmentIdsPaidSince(input: {
		clinicId: EntityId;
		installmentIds: EntityId[];
		paidSince: Date;
	}): Promise<PaymentEntity[]>;
	abstract findByClinicIdAndInstallmentIds(
		clinicId: EntityId,
		installmentIds: EntityId[],
	): Promise<PaymentEntity[]>;
}
