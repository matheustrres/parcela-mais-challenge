import { TransactionContext } from '@/@core/application/transaction-manager';
import { EntityId } from '@/@core/domain/entities/entity-id';

import { CommunicationAttemptEntity } from '@/modules/communications/domain/entities/communication-attempt.entity';

export abstract class CommunicationAttemptRepository {
	abstract findRelevantForCollectionRun(input: {
		clinicId: EntityId;
		installmentIds: EntityId[];
		patientIds: EntityId[];
	}): Promise<CommunicationAttemptEntity[]>;
	abstract findByClinicIdAndInstallmentIds(
		clinicId: EntityId,
		installmentIds: EntityId[],
	): Promise<CommunicationAttemptEntity[]>;
	abstract createMany(
		attempts: CommunicationAttemptEntity[],
		tx?: TransactionContext,
	): Promise<void>;
}
