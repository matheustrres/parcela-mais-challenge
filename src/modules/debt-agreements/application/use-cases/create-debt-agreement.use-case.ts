import { Injectable } from '@nestjs/common';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { TransactionManager } from '@/@core/application/transaction-manager';
import { UseCase } from '@/@core/application/use-case';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { EDebtAgreementStatus, EInstallmentStatus } from '@/@core/enums/domain';

import { ClinicRepository } from '@/modules/clinics/application/repositories/clinic.repository';
import { DebtAgreementRepository } from '@/modules/debt-agreements/application/repositories/debt-agreement.repository';
import { DebtAgreementEntity } from '@/modules/debt-agreements/domain/entities/debt-agreement.entity';
import { InstallmentSchedulePolicyDomainService } from '@/modules/debt-agreements/domain/services/installment-schedule-policy.service';
import { InstallmentRepository } from '@/modules/installments/application/repositories/installment.repository';
import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { PatientRepository } from '@/modules/patients/application/repositories/patient.repository';

type CreateDebtAgreementInput = {
	clinicId: string;
	patientId: string;
	totalAmountCents: number;
	installmentsCount: number;
	firstDueDate: Date;
};

type CreateDebtAgreementOutput = {
	debtAgreementId: string;
	installments: {
		id: string;
		installmentNumber: number;
		amountCents: number;
		dueDate: Date;
		status: string;
	}[];
};

@Injectable()
export class CreateDebtAgreementUseCase implements UseCase<
	CreateDebtAgreementInput,
	CreateDebtAgreementOutput
> {
	constructor(
		private readonly clinicRepository: ClinicRepository,
		private readonly patientRepository: PatientRepository,
		private readonly debtAgreementRepository: DebtAgreementRepository,
		private readonly installmentRepository: InstallmentRepository,
		private readonly installmentSchedulePolicy: InstallmentSchedulePolicyDomainService,
		private readonly transactionManager: TransactionManager,
	) {}

	async exec(
		input: CreateDebtAgreementInput,
	): Promise<CreateDebtAgreementOutput> {
		const clinicId = EntityUuid.createFrom(input.clinicId);
		const patientId = EntityUuid.createFrom(input.patientId);

		const clinic = await this.clinicRepository.findById(clinicId);
		if (!clinic) {
			throw new ApplicationException('CLINIC_NOT_FOUND', 404);
		}

		const patient = await this.patientRepository.findById(patientId);
		if (!patient) {
			throw new ApplicationException('PATIENT_NOT_FOUND', 404);
		}

		if (!patient.clinicId.equals(clinic.id)) {
			throw new ApplicationException('PATIENT_DOES_NOT_BELONG_TO_CLINIC', 422);
		}

		const totalAmount = MoneyVo.fromCents(input.totalAmountCents);
		const debtAgreement = DebtAgreementEntity.create({
			clinicId,
			patientId,
			totalAmount,
			installmentsCount: input.installmentsCount,
			status: EDebtAgreementStatus.Active,
		});

		const installmentAmounts = totalAmount.splitEqually(
			input.installmentsCount,
		);
		const dueDates = this.installmentSchedulePolicy.generateDueDates({
			firstDueDate: input.firstDueDate,
			installmentsCount: input.installmentsCount,
		});

		const installments = installmentAmounts.map((amount, index) =>
			InstallmentEntity.create({
				clinicId,
				debtAgreementId: debtAgreement.id,
				installmentNumber: index + 1,
				dueDate: dueDates[index]!,
				amount,
				paidAmount: MoneyVo.zero(),
				status: EInstallmentStatus.Pending,
				paidAt: null,
				version: 0,
			}),
		);

		const output: CreateDebtAgreementOutput = {
			debtAgreementId: debtAgreement.id.toString(),
			installments: installments.map((installment) => ({
				id: installment.id.toString(),
				installmentNumber: installment.installmentNumber,
				amountCents: installment.amount.getCents(),
				dueDate: installment.dueDate,
				status: installment.status,
			})),
		};

		return this.transactionManager.run(async (tx) => {
			await this.debtAgreementRepository.create(debtAgreement, tx);
			await this.installmentRepository.createMany(installments, tx);
			return output;
		});
	}
}
