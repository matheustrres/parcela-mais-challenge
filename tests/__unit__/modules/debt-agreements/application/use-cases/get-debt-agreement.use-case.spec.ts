import { beforeEach, describe, expect, it } from 'vitest';
import { MockProxy } from 'vitest-mock-extended';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { EInstallmentStatus } from '@/@core/enums/domain';

import { ClinicRepository } from '@/modules/clinics/application/repositories/clinic.repository';
import {
	DebtAgreementDetail,
	DebtAgreementQueryRepository,
} from '@/modules/debt-agreements/application/repositories/debt-agreement-query.repository';
import { GetDebtAgreementUseCase } from '@/modules/debt-agreements/application/use-cases/get-debt-agreement.use-case';

import { buildClinicEntity } from '#/data/builders/entities/clinic.entity.builder';
import { buildDebtAgreementEntity } from '#/data/builders/entities/debt-agreement.entity.builder';
import { buildInstallmentEntity } from '#/data/builders/entities/installment.entity.builder';
import { makeClinicRepositoryMock } from '#/data/mocks/repositories/clinic.repository.mock';
import { makeDebtAgreementQueryRepositoryMock } from '#/data/mocks/repositories/debt-agreement-query.repository.mock';

describe('GetDebtAgreementUseCase', () => {
	let clinicRepository: MockProxy<ClinicRepository>;
	let debtAgreementQueryRepository: MockProxy<DebtAgreementQueryRepository>;
	let useCase: GetDebtAgreementUseCase;

	const clinicId = '11111111-1111-4111-8111-111111111111';
	const debtAgreementId = '22222222-2222-4222-8222-222222222222';
	const patientId = '33333333-3333-4333-8333-333333333333';

	const makeDetail = (): DebtAgreementDetail => ({
		debtAgreement: buildDebtAgreementEntity({
			id: debtAgreementId,
			clinicId,
			patientId,
			totalAmountCents: 1_000,
			installmentsCount: 3,
		}),
		patient: {
			id: patientId,
			name: 'Ana Parcelada',
		},
		installments: [
			buildInstallmentEntity({
				id: '44444444-4444-4444-8444-444444444441',
				clinicId,
				debtAgreementId,
				installmentNumber: 1,
				dueDate: new Date('2026-06-01T00:00:00.000Z'),
				amountCents: 334,
				paidAmountCents: 100,
				status: EInstallmentStatus.PartiallyPaid,
			}),
			buildInstallmentEntity({
				id: '44444444-4444-4444-8444-444444444442',
				clinicId,
				debtAgreementId,
				installmentNumber: 2,
				dueDate: new Date('2026-06-10T12:00:00.000Z'),
				amountCents: 333,
				paidAmountCents: 0,
				status: EInstallmentStatus.Pending,
			}),
			buildInstallmentEntity({
				id: '44444444-4444-4444-8444-444444444443',
				clinicId,
				debtAgreementId,
				installmentNumber: 3,
				dueDate: new Date('2026-07-10T00:00:00.000Z'),
				amountCents: 333,
				paidAmountCents: 333,
				status: EInstallmentStatus.Paid,
				paidAt: new Date('2026-06-05T12:00:00.000Z'),
			}),
		],
	});

	beforeEach(() => {
		clinicRepository = makeClinicRepositoryMock();
		debtAgreementQueryRepository = makeDebtAgreementQueryRepositoryMock();
		useCase = new GetDebtAgreementUseCase(
			clinicRepository,
			debtAgreementQueryRepository,
		);
	});

	it('should return debt agreement detail successfully', async () => {
		clinicRepository.findById.mockResolvedValue(
			buildClinicEntity({ id: clinicId }),
		);
		debtAgreementQueryRepository.findByIdAndClinicId.mockResolvedValue(
			makeDetail(),
		);

		const output = await useCase.exec({
			clinicId,
			debtAgreementId,
			referenceDate: new Date('2026-06-10T15:00:00.000Z'),
		});

		expect(output).toMatchObject({
			id: debtAgreementId,
			clinicId,
			patient: {
				id: patientId,
				name: 'Ana Parcelada',
			},
			totalAmountCents: 1_000,
			paidAmountCents: 433,
			remainingAmountCents: 567,
			installmentsCount: 3,
			status: 'ACTIVE',
		});
		expect(output.installments).toHaveLength(3);
		expect(
			output.installments.map((installment) => installment.derivedStatus),
		).toEqual(['OVERDUE', 'DUE_TODAY', 'PAID']);
	});

	it('should throw when clinic is not found', async () => {
		clinicRepository.findById.mockResolvedValue(null);

		await expect(
			useCase.exec({
				clinicId,
				debtAgreementId,
				referenceDate: new Date('2026-06-10T15:00:00.000Z'),
			}),
		).rejects.toEqual(new ApplicationException('CLINIC_NOT_FOUND'));
	});

	it('should throw when debt agreement is not found', async () => {
		clinicRepository.findById.mockResolvedValue(
			buildClinicEntity({ id: clinicId }),
		);
		debtAgreementQueryRepository.findByIdAndClinicId.mockResolvedValue(null);

		await expect(
			useCase.exec({
				clinicId,
				debtAgreementId,
				referenceDate: new Date('2026-06-10T15:00:00.000Z'),
			}),
		).rejects.toEqual(new ApplicationException('DEBT_AGREEMENT_NOT_FOUND'));
	});

	it('should return not found for debt agreement from another clinic', async () => {
		clinicRepository.findById.mockResolvedValue(
			buildClinicEntity({ id: clinicId }),
		);
		debtAgreementQueryRepository.findByIdAndClinicId.mockResolvedValue(null);

		await expect(
			useCase.exec({
				clinicId,
				debtAgreementId,
				referenceDate: new Date('2026-06-10T15:00:00.000Z'),
			}),
		).rejects.toEqual(new ApplicationException('DEBT_AGREEMENT_NOT_FOUND'));
	});

	it('should throw when referenceDate is invalid', async () => {
		clinicRepository.findById.mockResolvedValue(
			buildClinicEntity({ id: clinicId }),
		);

		await expect(
			useCase.exec({
				clinicId,
				debtAgreementId,
				referenceDate: new Date('invalid'),
			}),
		).rejects.toEqual(new ApplicationException('INVALID_DEBT_AGREEMENT_QUERY'));
		expect(
			debtAgreementQueryRepository.findByIdAndClinicId,
		).not.toHaveBeenCalled();
	});
});
