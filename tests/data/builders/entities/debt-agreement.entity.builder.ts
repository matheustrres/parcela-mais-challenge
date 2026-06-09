import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { EDebtAgreementStatus } from '@/@core/enums/domain';

import { DebtAgreementEntity } from '@/modules/debt-agreements/domain/entities/debt-agreement.entity';

type BuildDebtAgreementEntityOverrides = {
	id?: string;
	clinicId?: string;
	patientId?: string;
	totalAmountCents?: number;
	installmentsCount?: number;
	status?: EDebtAgreementStatus;
};

export function buildDebtAgreementEntity(
	overrides: BuildDebtAgreementEntityOverrides = {},
): DebtAgreementEntity {
	return DebtAgreementEntity.createFrom(
		EntityUuid.createFrom(overrides.id ?? 'debt-agreement-1'),
		{
			clinicId: EntityUuid.createFrom(overrides.clinicId ?? 'clinic-1'),
			patientId: EntityUuid.createFrom(overrides.patientId ?? 'patient-1'),
			totalAmount: MoneyVo.fromCents(overrides.totalAmountCents ?? 1_000),
			installmentsCount: overrides.installmentsCount ?? 1,
			status: overrides.status ?? EDebtAgreementStatus.Active,
		},
	);
}
