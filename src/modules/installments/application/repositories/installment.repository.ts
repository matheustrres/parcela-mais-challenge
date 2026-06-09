import { TransactionContext } from '@/@core/application/transaction-manager';
import { EntityId } from '@/@core/domain/entities/entity-id';

import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';

export abstract class InstallmentRepository {
	abstract findByIdAndClinicId(
		id: EntityId,
		clinicId: EntityId,
	): Promise<InstallmentEntity | null>;
	abstract createMany(
		installments: InstallmentEntity[],
		tx?: TransactionContext,
	): Promise<void>;
	abstract update(
		installment: InstallmentEntity,
		tx?: TransactionContext,
	): Promise<void>;
}
