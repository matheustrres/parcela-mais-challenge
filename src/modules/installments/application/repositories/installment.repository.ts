import { TransactionContext } from '@/@core/application/transaction-manager';

import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';

export abstract class InstallmentRepository {
	abstract createMany(
		installments: InstallmentEntity[],
		tx?: TransactionContext,
	): Promise<void>;
}
