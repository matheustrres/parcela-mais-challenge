import { Injectable } from '@nestjs/common';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { UseCase } from '@/@core/application/use-case';
import { EDebtAgreementStatus, EInstallmentStatus } from '@/@core/enums/domain';

import { ClinicRepository } from '@/modules/clinics/application/repositories/clinic.repository';
import { DebtAgreementQueryRepository } from '@/modules/debt-agreements/application/repositories/debt-agreement-query.repository';
import {
	ensureValidOptionalUuid,
	ensureValidUuid,
} from '@/modules/debt-agreements/application/use-cases/helpers/ensure-valid-uuid';

export type ListDebtAgreementsInput = {
	clinicId: string;
	patientId?: string;
	status?: string;
	referenceDate?: Date;
	limit?: number;
	offset?: number;
};

type ListDebtAgreementsItemOutput = {
	id: string;
	patientId: string;
	patientName: string;
	totalAmountCents: number;
	paidAmountCents: number;
	remainingAmountCents: number;
	installmentsCount: number;
	paidInstallments: number;
	openInstallments: number;
	overdueInstallments: number;
	status: string;
	createdAt: Date;
};

export type ListDebtAgreementsOutput = {
	items: ListDebtAgreementsItemOutput[];
	total: number;
	limit: number;
	offset: number;
	referenceDate: Date;
};

@Injectable()
export class ListDebtAgreementsUseCase implements UseCase<
	ListDebtAgreementsInput,
	ListDebtAgreementsOutput
> {
	constructor(
		private readonly clinicRepository: ClinicRepository,
		private readonly debtAgreementQueryRepository: DebtAgreementQueryRepository,
	) {}

	async exec(
		input: ListDebtAgreementsInput,
	): Promise<ListDebtAgreementsOutput> {
		const clinicId = ensureValidUuid(
			input.clinicId,
			'INVALID_DEBT_AGREEMENT_QUERY',
		);

		const clinic = await this.clinicRepository.findById(clinicId);
		if (!clinic) {
			throw new ApplicationException('CLINIC_NOT_FOUND');
		}

		const patientId = ensureValidOptionalUuid(
			input.patientId,
			'INVALID_DEBT_AGREEMENT_QUERY',
		);
		const status = this.ensureValidStatus(input.status);
		const referenceDate = this.resolveReferenceDate(input.referenceDate);
		const limit = this.ensureValidLimit(input.limit);
		const offset = this.ensureValidOffset(input.offset);

		const result = await this.debtAgreementQueryRepository.findByClinicId({
			clinicId,
			patientId,
			status,
			limit,
			offset,
		});

		return {
			items: result.items.map(({ debtAgreement, patient, installments }) => {
				const paidAmountCents = installments.reduce(
					(total, installment) => total + installment.paidAmount.getCents(),
					0,
				);
				const remainingAmountCents = installments.reduce(
					(total, installment) =>
						total + installment.getRemainingAmount().getCents(),
					0,
				);
				const paidInstallments = installments.filter(
					(installment) => installment.status === EInstallmentStatus.Paid,
				).length;
				const openInstallments = installments.filter((installment) =>
					[
						EInstallmentStatus.Pending,
						EInstallmentStatus.PartiallyPaid,
					].includes(installment.status),
				).length;
				const overdueInstallments = installments.filter((installment) =>
					installment.isOverdue(referenceDate),
				).length;

				return {
					id: debtAgreement.id.toString(),
					patientId: patient.id,
					patientName: patient.name,
					totalAmountCents: debtAgreement.totalAmount.getCents(),
					paidAmountCents,
					remainingAmountCents,
					installmentsCount: debtAgreement.installmentsCount,
					paidInstallments,
					openInstallments,
					overdueInstallments,
					status: debtAgreement.status,
					createdAt: debtAgreement.createdAt,
				};
			}),
			total: result.total,
			limit,
			offset,
			referenceDate,
		};
	}
	private ensureValidStatus(status?: string): EDebtAgreementStatus | undefined {
		if (status === undefined) {
			return undefined;
		}
		if (
			!Object.values(EDebtAgreementStatus).includes(
				status as EDebtAgreementStatus,
			)
		) {
			throw new ApplicationException('INVALID_DEBT_AGREEMENT_QUERY');
		}
		return status as EDebtAgreementStatus;
	}

	private resolveReferenceDate(referenceDate?: Date): Date {
		if (referenceDate === undefined) {
			return new Date();
		}
		if (
			!(referenceDate instanceof Date) ||
			Number.isNaN(referenceDate.getTime())
		) {
			throw new ApplicationException('INVALID_DEBT_AGREEMENT_QUERY');
		}
		return referenceDate;
	}

	private ensureValidLimit(limit?: number): number {
		const resolvedLimit = limit ?? 50;
		if (
			!Number.isInteger(resolvedLimit) ||
			!Number.isSafeInteger(resolvedLimit) ||
			resolvedLimit <= 0
		) {
			throw new ApplicationException('INVALID_DEBT_AGREEMENT_PAGINATION');
		}
		return resolvedLimit;
	}

	private ensureValidOffset(offset?: number): number {
		const resolvedOffset = offset ?? 0;
		if (
			!Number.isInteger(resolvedOffset) ||
			!Number.isSafeInteger(resolvedOffset) ||
			resolvedOffset < 0
		) {
			throw new ApplicationException('INVALID_DEBT_AGREEMENT_PAGINATION');
		}
		return resolvedOffset;
	}
}
