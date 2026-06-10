import { Injectable } from '@nestjs/common';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { UseCase } from '@/@core/application/use-case';

import { ClinicRepository } from '@/modules/clinics/application/repositories/clinic.repository';
import { DebtAgreementQueryRepository } from '@/modules/debt-agreements/application/repositories/debt-agreement-query.repository';
import { ensureValidUuid } from '@/modules/debt-agreements/application/use-cases/helpers/ensure-valid-uuid';

type GetDebtAgreementInput = {
	debtAgreementId: string;
	clinicId: string;
	referenceDate?: Date;
};

type GetDebtAgreementOutput = {
	id: string;
	clinicId: string;
	patient: {
		id: string;
		name: string;
	};
	totalAmountCents: number;
	paidAmountCents: number;
	remainingAmountCents: number;
	installmentsCount: number;
	status: string;
	installments: {
		id: string;
		installmentNumber: number;
		dueDate: Date;
		amountCents: number;
		paidAmountCents: number;
		remainingAmountCents: number;
		status: string;
		derivedStatus: string;
		paidAt: Date | null;
	}[];
};

@Injectable()
export class GetDebtAgreementUseCase implements UseCase<
	GetDebtAgreementInput,
	GetDebtAgreementOutput
> {
	constructor(
		private readonly clinicRepository: ClinicRepository,
		private readonly debtAgreementQueryRepository: DebtAgreementQueryRepository,
	) {}

	async exec(input: GetDebtAgreementInput): Promise<GetDebtAgreementOutput> {
		const clinicId = ensureValidUuid(
			input.clinicId,
			'INVALID_DEBT_AGREEMENT_QUERY',
		);
		const debtAgreementId = ensureValidUuid(
			input.debtAgreementId,
			'INVALID_DEBT_AGREEMENT_QUERY',
		);

		const clinic = await this.clinicRepository.findById(clinicId);
		if (!clinic) {
			throw new ApplicationException('CLINIC_NOT_FOUND');
		}

		const referenceDate = this.ensureValidReferenceDate(input.referenceDate);
		const result = await this.debtAgreementQueryRepository.findByIdAndClinicId(
			debtAgreementId,
			clinicId,
		);

		if (!result) {
			throw new ApplicationException('DEBT_AGREEMENT_NOT_FOUND');
		}

		const paidAmountCents = result.installments.reduce(
			(total, installment) => total + installment.paidAmount.getCents(),
			0,
		);
		const remainingAmountCents = result.installments.reduce(
			(total, installment) =>
				total + installment.getRemainingAmount().getCents(),
			0,
		);

		return {
			id: result.debtAgreement.id.toString(),
			clinicId: result.debtAgreement.clinicId.toString(),
			patient: result.patient,
			totalAmountCents: result.debtAgreement.totalAmount.getCents(),
			paidAmountCents,
			remainingAmountCents,
			installmentsCount: result.debtAgreement.installmentsCount,
			status: result.debtAgreement.status,
			installments: result.installments.map((installment) => ({
				id: installment.id.toString(),
				installmentNumber: installment.installmentNumber,
				dueDate: installment.dueDate,
				amountCents: installment.amount.getCents(),
				paidAmountCents: installment.paidAmount.getCents(),
				remainingAmountCents: installment.getRemainingAmount().getCents(),
				status: installment.status,
				derivedStatus: installment.getDerivedStatus(referenceDate),
				paidAt: installment.paidAt,
			})),
		};
	}

	private ensureValidReferenceDate(referenceDate?: Date): Date {
		if (
			!(referenceDate instanceof Date) ||
			Number.isNaN(referenceDate.getTime())
		) {
			throw new ApplicationException('INVALID_DEBT_AGREEMENT_QUERY');
		}
		return referenceDate;
	}
}
