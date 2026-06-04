import { describe, expect, it } from 'vitest';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { EInstallmentStatus } from '@/@core/enums/domain';

import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { InstallmentStatusPolicyDomainService } from '@/modules/installments/domain/services/installment-status-policy.service';

describe('InstallmentStatusPolicyDomainService', () => {
	const service = new InstallmentStatusPolicyDomainService();
	const makeProps = () => ({
		clinicId: EntityUuid.createFrom('clinic-id'),
		debtAgreementId: EntityUuid.createFrom('agreement-id'),
		installmentNumber: 1,
		dueDate: new Date('2024-04-10T12:00:00.000Z'),
		amount: MoneyVo.fromCents(10_000),
		paidAmount: MoneyVo.zero(),
		status: EInstallmentStatus.Pending,
		paidAt: null,
		version: 0,
	});

	it('should delegate deriveStatus to the entity', () => {
		const installment = InstallmentEntity.create({
			...makeProps(),
			paidAmount: MoneyVo.fromCents(2_500),
			status: EInstallmentStatus.PartiallyPaid,
		});
		const referenceDate = new Date('2024-04-11T08:00:00.000Z');

		expect(service.deriveStatus(installment, referenceDate)).toBe(
			installment.getDerivedStatus(referenceDate),
		);
	});

	it('should delegate isOverdue to the entity', () => {
		const installment = InstallmentEntity.create(makeProps());
		const referenceDate = new Date('2024-04-11T08:00:00.000Z');

		expect(service.isOverdue(installment, referenceDate)).toBe(
			installment.isOverdue(referenceDate),
		);
	});

	it('should delegate isDueToday to the entity', () => {
		const installment = InstallmentEntity.create(makeProps());
		const referenceDate = new Date('2024-04-10T23:59:00.000Z');

		expect(service.isDueToday(installment, referenceDate)).toBe(
			installment.isDueToday(referenceDate),
		);
	});

	it('should delegate getDaysOverdue to the entity', () => {
		const installment = InstallmentEntity.create(makeProps());
		const referenceDate = new Date('2024-04-15T08:00:00.000Z');

		expect(service.getDaysOverdue(installment, referenceDate)).toBe(
			installment.getDaysOverdue(referenceDate),
		);
	});
});
