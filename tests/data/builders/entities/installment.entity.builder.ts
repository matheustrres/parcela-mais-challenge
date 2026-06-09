import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { EInstallmentStatus } from '@/@core/enums/domain';

import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';

type BuildInstallmentEntityOverrides = {
	id?: string;
	clinicId?: string;
	debtAgreementId?: string;
	installmentNumber?: number;
	dueDate?: Date;
	amountCents?: number;
	paidAmountCents?: number;
	status?: EInstallmentStatus;
	paidAt?: Date | null;
	version?: number;
};

export function buildInstallmentEntity(
	overrides: BuildInstallmentEntityOverrides = {},
): InstallmentEntity {
	return InstallmentEntity.createFrom(
		EntityUuid.createFrom(overrides.id ?? 'installment-1'),
		{
			clinicId: EntityUuid.createFrom(overrides.clinicId ?? 'clinic-1'),
			debtAgreementId: EntityUuid.createFrom(
				overrides.debtAgreementId ?? 'debt-agreement-1',
			),
			installmentNumber: overrides.installmentNumber ?? 1,
			dueDate: overrides.dueDate ?? new Date('2026-01-10T12:00:00.000Z'),
			amount: MoneyVo.fromCents(overrides.amountCents ?? 1_000),
			paidAmount: MoneyVo.fromCents(overrides.paidAmountCents ?? 0),
			status: overrides.status ?? EInstallmentStatus.Pending,
			paidAt: overrides.paidAt ?? null,
			version: overrides.version ?? 0,
		},
	);
}
