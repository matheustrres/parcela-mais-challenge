import { TransactionContext } from '@/@core/application/transaction-manager';
import { EntityId } from '@/@core/domain/entities/entity-id';

import { DebtAgreementEntity } from '@/modules/debt-agreements/domain/entities/debt-agreement.entity';

export abstract class DebtAgreementRepository {
	abstract findById(id: EntityId): Promise<DebtAgreementEntity | null>;
	abstract create(
		debtAgreement: DebtAgreementEntity,
		tx?: TransactionContext,
	): Promise<void>;
}
