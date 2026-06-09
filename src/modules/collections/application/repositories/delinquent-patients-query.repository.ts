import { EntityId } from '@/@core/domain/entities/entity-id';

import { DebtAgreementEntity } from '@/modules/debt-agreements/domain/entities/debt-agreement.entity';
import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { PatientEntity } from '@/modules/patients/domain/entities/patient.entity';

export type DelinquentPatientCandidate = {
	installment: InstallmentEntity;
	patient: PatientEntity;
	debtAgreement: DebtAgreementEntity;
};

export abstract class DelinquentPatientsQueryRepository {
	abstract findByClinicId(
		clinicId: EntityId,
		referenceDate: Date,
	): Promise<DelinquentPatientCandidate[]>;
}
