import { beforeEach, describe, expect, it } from 'vitest';
import { MockProxy } from 'vitest-mock-extended';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { TransactionManager } from '@/@core/application/transaction-manager';
import { DomainException } from '@/@core/domain/exceptions/domain-exception';
import { EDebtAgreementStatus, EInstallmentStatus } from '@/@core/enums/domain';

import { ClinicRepository } from '@/modules/clinics/application/repositories/clinic.repository';
import { DebtAgreementRepository } from '@/modules/debt-agreements/application/repositories/debt-agreement.repository';
import { CreateDebtAgreementUseCase } from '@/modules/debt-agreements/application/use-cases/create-debt-agreement.use-case';
import { InstallmentSchedulePolicyDomainService } from '@/modules/debt-agreements/domain/services/installment-schedule-policy.service';
import { InstallmentRepository } from '@/modules/installments/application/repositories/installment.repository';
import { PatientRepository } from '@/modules/patients/application/repositories/patient.repository';

import { buildClinicEntity } from '#/data/builders/entities/clinic.entity.builder';
import { buildPatientEntity } from '#/data/builders/entities/patient.entity.builder';
import { makeClinicRepositoryMock } from '#/data/mocks/repositories/clinic.repository.mock';
import { makeDebtAgreementRepositoryMock } from '#/data/mocks/repositories/debt-agreement.repository.mock';
import { makeInstallmentRepositoryMock } from '#/data/mocks/repositories/installment.repository.mock';
import { makePatientRepositoryMock } from '#/data/mocks/repositories/patient.repository.mock';
import { makeInstallmentSchedulePolicyServiceMock } from '#/data/mocks/services/installment-schedule-policy.service.mock';
import {
	makeTransactionManagerMock,
	TransactionManagerMockBundle,
} from '#/data/mocks/services/transaction-manager.mock';

describe('CreateDebtAgreementUseCase', () => {
	let clinicRepository: MockProxy<ClinicRepository>;
	let patientRepository: MockProxy<PatientRepository>;
	let debtAgreementRepository: MockProxy<DebtAgreementRepository>;
	let installmentRepository: MockProxy<InstallmentRepository>;
	let installmentSchedulePolicy: MockProxy<InstallmentSchedulePolicyDomainService>;
	let transactionManagerBundle: TransactionManagerMockBundle;
	let useCase: CreateDebtAgreementUseCase;

	const clinicId = 'clinic-1';
	const patientId = 'patient-1';

	beforeEach(() => {
		clinicRepository = makeClinicRepositoryMock();
		patientRepository = makePatientRepositoryMock();
		debtAgreementRepository = makeDebtAgreementRepositoryMock();
		installmentRepository = makeInstallmentRepositoryMock();
		installmentSchedulePolicy = makeInstallmentSchedulePolicyServiceMock();
		transactionManagerBundle = makeTransactionManagerMock();
		useCase = new CreateDebtAgreementUseCase(
			clinicRepository,
			patientRepository,
			debtAgreementRepository,
			installmentRepository,
			installmentSchedulePolicy,
			transactionManagerBundle.transactionManager as TransactionManager,
		);
	});

	it('should create debt agreement and installments successfully', async () => {
		clinicRepository.findById.mockResolvedValue(
			buildClinicEntity({ id: clinicId }),
		);
		patientRepository.findById.mockResolvedValue(
			buildPatientEntity({
				id: patientId,
				clinicId,
			}),
		);
		installmentSchedulePolicy.generateDueDates.mockReturnValue([
			new Date(2026, 0, 31, 9, 30, 0, 0),
			new Date(2026, 1, 28, 9, 30, 0, 0),
			new Date(2026, 2, 31, 9, 30, 0, 0),
		]);
		debtAgreementRepository.create.mockResolvedValue();
		installmentRepository.createMany.mockResolvedValue();

		const output = await useCase.exec({
			clinicId,
			patientId,
			totalAmountCents: 1_000,
			installmentsCount: 3,
			firstDueDate: new Date(2026, 0, 31, 9, 30, 0, 0),
		});

		expect(
			transactionManagerBundle.transactionManager.run,
		).toHaveBeenCalledOnce();
		expect(installmentSchedulePolicy.generateDueDates).toHaveBeenCalledWith({
			firstDueDate: new Date(2026, 0, 31, 9, 30, 0, 0),
			installmentsCount: 3,
		});
		expect(debtAgreementRepository.create).toHaveBeenCalledOnce();
		expect(installmentRepository.createMany).toHaveBeenCalledOnce();

		const [createdAgreement, agreementTx] =
			debtAgreementRepository.create.mock.calls[0]!;
		const [createdInstallments, installmentsTx] =
			installmentRepository.createMany.mock.calls[0]!;

		expect(createdAgreement.status).toBe(EDebtAgreementStatus.Active);
		expect(agreementTx).toBe(transactionManagerBundle.txContext);
		expect(installmentsTx).toBe(transactionManagerBundle.txContext);
		expect(
			createdInstallments.map((installment) => ({
				number: installment.installmentNumber,
				amount: installment.amount.getCents(),
				day: installment.dueDate.getDate(),
				status: installment.status,
			})),
		).toEqual([
			{ number: 1, amount: 334, day: 31, status: EInstallmentStatus.Pending },
			{ number: 2, amount: 333, day: 28, status: EInstallmentStatus.Pending },
			{ number: 3, amount: 333, day: 31, status: EInstallmentStatus.Pending },
		]);
		expect(output.debtAgreementId).toBe(createdAgreement.id.toString());
		expect(output.installments).toHaveLength(3);
		expect(
			output.installments.map((installment) => installment.amountCents),
		).toEqual([334, 333, 333]);
	});

	it('should throw when clinic is not found', async () => {
		clinicRepository.findById.mockResolvedValue(null);

		await expect(
			useCase.exec({
				clinicId,
				patientId,
				totalAmountCents: 1_000,
				installmentsCount: 3,
				firstDueDate: new Date('2026-01-15T12:00:00.000Z'),
			}),
		).rejects.toThrowError(new ApplicationException('CLINIC_NOT_FOUND'));
	});

	it('should throw when patient is not found', async () => {
		clinicRepository.findById.mockResolvedValue(
			buildClinicEntity({ id: clinicId }),
		);
		patientRepository.findById.mockResolvedValue(null);

		await expect(
			useCase.exec({
				clinicId,
				patientId,
				totalAmountCents: 1_000,
				installmentsCount: 3,
				firstDueDate: new Date('2026-01-15T12:00:00.000Z'),
			}),
		).rejects.toThrowError(new ApplicationException('PATIENT_NOT_FOUND'));
	});

	it('should throw when patient belongs to another clinic', async () => {
		clinicRepository.findById.mockResolvedValue(
			buildClinicEntity({ id: clinicId }),
		);
		patientRepository.findById.mockResolvedValue(
			buildPatientEntity({
				id: patientId,
				clinicId: 'clinic-2',
			}),
		);

		await expect(
			useCase.exec({
				clinicId,
				patientId,
				totalAmountCents: 1_000,
				installmentsCount: 3,
				firstDueDate: new Date('2026-01-15T12:00:00.000Z'),
			}),
		).rejects.toThrowError(
			new ApplicationException('PATIENT_DOES_NOT_BELONG_TO_CLINIC'),
		);
	});

	it('should not call createMany when debt agreement create fails', async () => {
		clinicRepository.findById.mockResolvedValue(
			buildClinicEntity({ id: clinicId }),
		);
		patientRepository.findById.mockResolvedValue(
			buildPatientEntity({
				id: patientId,
				clinicId,
			}),
		);
		installmentSchedulePolicy.generateDueDates.mockReturnValue([
			new Date('2026-01-15T12:00:00.000Z'),
			new Date('2026-02-15T12:00:00.000Z'),
			new Date('2026-03-15T12:00:00.000Z'),
		]);
		debtAgreementRepository.create.mockRejectedValueOnce(new Error('db fail'));

		await expect(
			useCase.exec({
				clinicId,
				patientId,
				totalAmountCents: 1_000,
				installmentsCount: 3,
				firstDueDate: new Date('2026-01-15T12:00:00.000Z'),
			}),
		).rejects.toThrowError('db fail');

		expect(debtAgreementRepository.create).toHaveBeenCalledOnce();
		expect(installmentRepository.createMany).not.toHaveBeenCalled();
	});

	it('should propagate createMany failure', async () => {
		clinicRepository.findById.mockResolvedValue(
			buildClinicEntity({ id: clinicId }),
		);
		patientRepository.findById.mockResolvedValue(
			buildPatientEntity({
				id: patientId,
				clinicId,
			}),
		);
		installmentSchedulePolicy.generateDueDates.mockReturnValue([
			new Date('2026-01-15T12:00:00.000Z'),
			new Date('2026-02-15T12:00:00.000Z'),
			new Date('2026-03-15T12:00:00.000Z'),
		]);
		debtAgreementRepository.create.mockResolvedValue();
		installmentRepository.createMany.mockRejectedValueOnce(
			new Error('create many fail'),
		);

		await expect(
			useCase.exec({
				clinicId,
				patientId,
				totalAmountCents: 1_000,
				installmentsCount: 3,
				firstDueDate: new Date('2026-01-15T12:00:00.000Z'),
			}),
		).rejects.toThrowError('create many fail');

		expect(installmentRepository.createMany).toHaveBeenCalledOnce();
	});

	it('should propagate entity financial validation errors', async () => {
		clinicRepository.findById.mockResolvedValue(
			buildClinicEntity({ id: clinicId }),
		);
		patientRepository.findById.mockResolvedValue(
			buildPatientEntity({
				id: patientId,
				clinicId,
			}),
		);

		await expect(
			useCase.exec({
				clinicId,
				patientId,
				totalAmountCents: 0,
				installmentsCount: 3,
				firstDueDate: new Date('2026-01-15T12:00:00.000Z'),
			}),
		).rejects.toThrowError(
			new DomainException('DEBT_AGREEMENT_TOTAL_AMOUNT_MUST_BE_POSITIVE'),
		);
	});
});
