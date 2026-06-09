import { EntityId } from '@/@core/domain/entities/entity-id';

import { DebtAgreementEntity } from '@/modules/debt-agreements/domain/entities/debt-agreement.entity';
import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { PatientEntity } from '@/modules/patients/domain/entities/patient.entity';

export type CollectionCandidate = {
	installment: InstallmentEntity;
	patient: PatientEntity;
	debtAgreement: DebtAgreementEntity;
};

export abstract class CollectionCandidateRepository {
	abstract findByClinicIdForRuleEvaluation(
		clinicId: EntityId,
	): Promise<CollectionCandidate[]>;
}
