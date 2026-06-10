import { EntityId } from '@/@core/domain/entities/entity-id';
import { EDebtAgreementStatus } from '@/@core/enums/domain';

import { DebtAgreementEntity } from '@/modules/debt-agreements/domain/entities/debt-agreement.entity';
import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';

export type DebtAgreementDetail = {
	debtAgreement: DebtAgreementEntity;
	patient: {
		id: string;
		name: string;
	};
	installments: InstallmentEntity[];
};

export type DebtAgreementListItem = {
	debtAgreement: DebtAgreementEntity;
	patient: {
		id: string;
		name: string;
	};
	installments: InstallmentEntity[];
};

export type PaginatedDebtAgreements = {
	items: DebtAgreementListItem[];
	total: number;
};

export abstract class DebtAgreementQueryRepository {
	abstract findByIdAndClinicId(
		debtAgreementId: EntityId,
		clinicId: EntityId,
	): Promise<DebtAgreementDetail | null>;
	abstract findByClinicId(input: {
		clinicId: EntityId;
		patientId?: EntityId;
		status?: EDebtAgreementStatus;
		limit: number;
		offset: number;
	}): Promise<PaginatedDebtAgreements>;
}
