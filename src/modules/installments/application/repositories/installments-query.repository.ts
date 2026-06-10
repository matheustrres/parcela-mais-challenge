import { EntityId } from '@/@core/domain/entities/entity-id';
import { EContactStatus, EDebtAgreementStatus } from '@/@core/enums/domain';

import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';

export type InstallmentListItem = {
	installment: InstallmentEntity;
	patient: {
		id: string;
		name: string;
		contactStatus: EContactStatus;
	};
	debtAgreement: {
		id: string;
		status: EDebtAgreementStatus;
		installmentsCount: number;
		totalAmountCents: number;
	};
};

export type PaginatedInstallments = {
	items: InstallmentListItem[];
	total: number;
};

export abstract class InstallmentsQueryRepository {
	abstract findByClinicId(input: {
		clinicId: EntityId;
		limit: number;
		offset: number;
	}): Promise<PaginatedInstallments>;
}
