import { Injectable } from '@nestjs/common';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { UseCase } from '@/@core/application/use-case';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';

import { ClinicRepository } from '@/modules/clinics/application/repositories/clinic.repository';
import { InstallmentsQueryRepository } from '@/modules/installments/application/repositories/installments-query.repository';

export type ListInstallmentsInput = {
	clinicId: string;
	referenceDate: Date;
	limit?: number;
	offset?: number;
};

export type ListInstallmentsOutput = {
	items: {
		id: string;
		debtAgreementId: string;
		installmentNumber: number;
		dueDate: Date;
		amountCents: number;
		paidAmountCents: number;
		remainingAmountCents: number;
		status: string;
		derivedStatus: string;
		paidAt: Date | null;
		patient: {
			id: string;
			name: string;
			contactStatus: string;
		};
		debtAgreement: {
			id: string;
			status: string;
			installmentsCount: number;
			totalAmountCents: number;
		};
	}[];
	total: number;
	limit: number;
	offset: number;
};

@Injectable()
export class ListInstallmentsUseCase implements UseCase<
	ListInstallmentsInput,
	ListInstallmentsOutput
> {
	constructor(
		private readonly clinicRepository: ClinicRepository,
		private readonly installmentsQueryRepository: InstallmentsQueryRepository,
	) {}

	async exec(input: ListInstallmentsInput): Promise<ListInstallmentsOutput> {
		const clinicId = EntityUuid.createFrom(input.clinicId);
		const referenceDate = this.ensureValidReferenceDate(input.referenceDate);
		const limit = this.ensureValidLimit(input.limit);
		const offset = this.ensureValidOffset(input.offset);

		const clinic = await this.clinicRepository.findById(clinicId);
		if (!clinic) {
			throw new ApplicationException('CLINIC_NOT_FOUND');
		}

		const result = await this.installmentsQueryRepository.findByClinicId({
			clinicId,
			limit,
			offset,
		});

		return {
			items: result.items.map(({ installment, patient, debtAgreement }) => ({
				id: installment.id.toString(),
				debtAgreementId: installment.debtAgreementId.toString(),
				installmentNumber: installment.installmentNumber,
				dueDate: installment.dueDate,
				amountCents: installment.amount.getCents(),
				paidAmountCents: installment.paidAmount.getCents(),
				remainingAmountCents: installment.getRemainingAmount().getCents(),
				status: installment.status,
				derivedStatus: installment.getDerivedStatus(referenceDate),
				paidAt: installment.paidAt,
				patient,
				debtAgreement,
			})),
			total: result.total,
			limit,
			offset,
		};
	}

	private ensureValidReferenceDate(referenceDate: Date): Date {
		if (
			!(referenceDate instanceof Date) ||
			Number.isNaN(referenceDate.getTime())
		) {
			throw new ApplicationException('INVALID_INSTALLMENTS_REFERENCE_DATE');
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
			throw new ApplicationException('INVALID_INSTALLMENTS_PAGINATION');
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
			throw new ApplicationException('INVALID_INSTALLMENTS_PAGINATION');
		}
		return resolvedOffset;
	}
}
