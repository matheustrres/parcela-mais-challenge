import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockProxy } from 'vitest-mock-extended';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { EDebtAgreementStatus, EInstallmentStatus } from '@/@core/enums/domain';

import { ClinicRepository } from '@/modules/clinics/application/repositories/clinic.repository';
import {
	DebtAgreementQueryRepository,
	PaginatedDebtAgreements,
} from '@/modules/debt-agreements/application/repositories/debt-agreement-query.repository';
import { ListDebtAgreementsUseCase } from '@/modules/debt-agreements/application/use-cases/list-debt-agreements.use-case';

import { buildClinicEntity } from '#/data/builders/entities/clinic.entity.builder';
import { buildDebtAgreementEntity } from '#/data/builders/entities/debt-agreement.entity.builder';
import { buildInstallmentEntity } from '#/data/builders/entities/installment.entity.builder';
import { makeClinicRepositoryMock } from '#/data/mocks/repositories/clinic.repository.mock';
import { makeDebtAgreementQueryRepositoryMock } from '#/data/mocks/repositories/debt-agreement-query.repository.mock';

describe('ListDebtAgreementsUseCase', () => {
	let clinicRepository: MockProxy<ClinicRepository>;
	let debtAgreementQueryRepository: MockProxy<DebtAgreementQueryRepository>;
	let useCase: ListDebtAgreementsUseCase;

	const clinicId = '11111111-1111-4111-8111-111111111111';
	const patientId = '22222222-2222-4222-8222-222222222222';
	const otherPatientId = '33333333-3333-4333-8333-333333333333';

	const makePage = (): PaginatedDebtAgreements => ({
		total: 2,
		items: [
			{
				debtAgreement: buildDebtAgreementEntity({
					id: '44444444-4444-4444-8444-444444444444',
					clinicId,
					patientId,
					totalAmountCents: 1_000,
					installmentsCount: 3,
				}),
				patient: {
					id: patientId,
					name: 'Ana',
				},
				installments: [
					buildInstallmentEntity({
						id: '55555555-5555-4555-8555-555555555551',
						clinicId,
						debtAgreementId: '44444444-4444-4444-8444-444444444444',
						installmentNumber: 1,
						dueDate: new Date('2026-06-01T12:00:00.000Z'),
						amountCents: 334,
						status: EInstallmentStatus.Pending,
					}),
					buildInstallmentEntity({
						id: '55555555-5555-4555-8555-555555555552',
						clinicId,
						debtAgreementId: '44444444-4444-4444-8444-444444444444',
						installmentNumber: 2,
						dueDate: new Date('2026-06-10T12:00:00.000Z'),
						amountCents: 333,
						paidAmountCents: 100,
						status: EInstallmentStatus.PartiallyPaid,
					}),
					buildInstallmentEntity({
						id: '55555555-5555-4555-8555-555555555553',
						clinicId,
						debtAgreementId: '44444444-4444-4444-8444-444444444444',
						installmentNumber: 3,
						dueDate: new Date('2026-07-10T00:00:00.000Z'),
						amountCents: 333,
						paidAmountCents: 333,
						status: EInstallmentStatus.Paid,
						paidAt: new Date('2026-06-02T12:00:00.000Z'),
					}),
				],
			},
			{
				debtAgreement: buildDebtAgreementEntity({
					id: '66666666-6666-4666-8666-666666666666',
					clinicId,
					patientId: otherPatientId,
					totalAmountCents: 500,
					installmentsCount: 1,
					status: EDebtAgreementStatus.Paid,
				}),
				patient: {
					id: otherPatientId,
					name: 'Bruno',
				},
				installments: [
					buildInstallmentEntity({
						id: '77777777-7777-4777-8777-777777777777',
						clinicId,
						debtAgreementId: '66666666-6666-4666-8666-666666666666',
						installmentNumber: 1,
						dueDate: new Date('2026-05-10T00:00:00.000Z'),
						amountCents: 500,
						paidAmountCents: 500,
						status: EInstallmentStatus.Paid,
						paidAt: new Date('2026-05-11T12:00:00.000Z'),
					}),
				],
			},
		],
	});

	beforeEach(() => {
		clinicRepository = makeClinicRepositoryMock();
		debtAgreementQueryRepository = makeDebtAgreementQueryRepositoryMock();
		useCase = new ListDebtAgreementsUseCase(
			clinicRepository,
			debtAgreementQueryRepository,
		);

		clinicRepository.findById.mockResolvedValue(
			buildClinicEntity({ id: clinicId }),
		);
		debtAgreementQueryRepository.findByClinicId.mockResolvedValue(makePage());
	});

	it('should list debt agreements with pagination and aggregates', async () => {
		const output = await useCase.exec({
			clinicId,
			referenceDate: new Date('2026-06-10T15:00:00.000Z'),
			limit: 10,
			offset: 0,
		});

		expect(output.total).toBe(2);
		expect(output.items[0]).toMatchObject({
			id: '44444444-4444-4444-8444-444444444444',
			patientId,
			patientName: 'Ana',
			totalAmountCents: 1_000,
			paidAmountCents: 433,
			remainingAmountCents: 567,
			installmentsCount: 3,
			paidInstallments: 1,
			openInstallments: 2,
			overdueInstallments: 1,
			status: 'ACTIVE',
		});
	});

	it('should pass patientId filter to repository', async () => {
		await useCase.exec({
			clinicId,
			patientId,
			referenceDate: new Date('2026-06-10T15:00:00.000Z'),
		});

		expect(
			debtAgreementQueryRepository.findByClinicId.mock.calls[0]?.[0].patientId?.toString(),
		).toBe(patientId);
	});

	it('should pass status filter to repository', async () => {
		await useCase.exec({
			clinicId,
			status: EDebtAgreementStatus.Paid,
			referenceDate: new Date('2026-06-10T15:00:00.000Z'),
		});

		expect(debtAgreementQueryRepository.findByClinicId).toHaveBeenCalledWith(
			expect.objectContaining({
				status: EDebtAgreementStatus.Paid,
			}),
		);
	});

	it('should use explicit referenceDate to calculate overdue installments', async () => {
		const output = await useCase.exec({
			clinicId,
			referenceDate: new Date('2026-06-01T12:00:00.000Z'),
		});

		expect(output.items[0]?.overdueInstallments).toBe(0);
	});

	it('should resolve current date when referenceDate is omitted', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-15T10:30:00.000Z'));

		const output = await useCase.exec({
			clinicId,
		});

		expect(output.referenceDate).toEqual(new Date('2026-06-15T10:30:00.000Z'));
		vi.useRealTimers();
	});

	it('should return empty list when patientId belongs to another clinic scope', async () => {
		debtAgreementQueryRepository.findByClinicId.mockResolvedValue({
			items: [],
			total: 0,
		});

		const output = await useCase.exec({
			clinicId,
			patientId: '99999999-9999-4999-8999-999999999999',
			referenceDate: new Date('2026-06-10T15:00:00.000Z'),
		});

		expect(output).toEqual({
			items: [],
			total: 0,
			limit: 50,
			offset: 0,
			referenceDate: new Date('2026-06-10T15:00:00.000Z'),
		});
	});

	it('should throw when clinic is not found', async () => {
		clinicRepository.findById.mockResolvedValue(null);

		await expect(
			useCase.exec({
				clinicId,
			}),
		).rejects.toEqual(new ApplicationException('CLINIC_NOT_FOUND'));
	});

	it('should throw when pagination is invalid', async () => {
		await expect(
			useCase.exec({
				clinicId,
				limit: 0,
			}),
		).rejects.toEqual(
			new ApplicationException('INVALID_DEBT_AGREEMENT_PAGINATION'),
		);

		await expect(
			useCase.exec({
				clinicId,
				offset: -1,
			}),
		).rejects.toEqual(
			new ApplicationException('INVALID_DEBT_AGREEMENT_PAGINATION'),
		);
	});

	it('should throw when query is invalid', async () => {
		await expect(
			useCase.exec({
				clinicId,
				patientId: 'invalid',
			}),
		).rejects.toEqual(new ApplicationException('INVALID_DEBT_AGREEMENT_QUERY'));

		await expect(
			useCase.exec({
				clinicId,
				status: 'BROKEN',
			}),
		).rejects.toEqual(new ApplicationException('INVALID_DEBT_AGREEMENT_QUERY'));

		await expect(
			useCase.exec({
				clinicId,
				referenceDate: new Date('invalid'),
			}),
		).rejects.toEqual(new ApplicationException('INVALID_DEBT_AGREEMENT_QUERY'));
	});
});
