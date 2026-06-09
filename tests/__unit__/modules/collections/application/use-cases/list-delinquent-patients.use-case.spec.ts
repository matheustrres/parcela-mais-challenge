import { beforeEach, describe, expect, it } from 'vitest';
import { MockProxy } from 'vitest-mock-extended';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import {
	ECommunicationChannel,
	ECommunicationType,
} from '@/@core/enums/domain';

import { ClinicRepository } from '@/modules/clinics/application/repositories/clinic.repository';
import {
	DelinquentPatientCandidate,
	DelinquentPatientsQueryRepository,
} from '@/modules/collections/application/repositories/delinquent-patients-query.repository';
import { ListDelinquentPatientsUseCase } from '@/modules/collections/application/use-cases/list-delinquent-patients.use-case';
import { ECollectionPriorityScoreReason } from '@/modules/collections/domain/enums/collection-priority-score-reason';
import { ECollectionRuleSkippedReason } from '@/modules/collections/domain/enums/collection-rule-skipped-reason';
import { CollectionPriorityScoreDomainService } from '@/modules/collections/domain/services/collection-priority-score.service';
import { CollectionRulePolicyDomainService } from '@/modules/collections/domain/services/collection-rule-policy.service';
import { CommunicationAttemptRepository } from '@/modules/communications/application/repositories/communication-attempt.repository';
import { PaymentRepository } from '@/modules/payments/application/repositories/payment.repository';

import { buildClinicEntity } from '#/data/builders/entities/clinic.entity.builder';
import { buildCommunicationAttemptEntity } from '#/data/builders/entities/communication-attempt.entity.builder';
import { buildDebtAgreementEntity } from '#/data/builders/entities/debt-agreement.entity.builder';
import { buildInstallmentEntity } from '#/data/builders/entities/installment.entity.builder';
import { buildPatientEntity } from '#/data/builders/entities/patient.entity.builder';
import { buildPaymentEntity } from '#/data/builders/entities/payment.entity.builder';
import { makeClinicRepositoryMock } from '#/data/mocks/repositories/clinic.repository.mock';
import { makeCommunicationAttemptRepositoryMock } from '#/data/mocks/repositories/communication-attempt.repository.mock';
import { makeDelinquentPatientsQueryRepositoryMock } from '#/data/mocks/repositories/delinquent-patients-query.repository.mock';
import { makePaymentRepositoryMock } from '#/data/mocks/repositories/payment.repository.mock';
import { makeCollectionPriorityScoreServiceMock } from '#/data/mocks/services/collection-priority-score.service.mock';
import { makeCollectionRulePolicyServiceMock } from '#/data/mocks/services/collection-rule-policy.service.mock';

describe('ListDelinquentPatientsUseCase', () => {
	let clinicRepository: MockProxy<ClinicRepository>;
	let delinquentPatientsQueryRepository: MockProxy<DelinquentPatientsQueryRepository>;
	let communicationAttemptRepository: MockProxy<CommunicationAttemptRepository>;
	let paymentRepository: MockProxy<PaymentRepository>;
	let collectionPriorityScore: MockProxy<CollectionPriorityScoreDomainService>;
	let collectionRulePolicy: MockProxy<CollectionRulePolicyDomainService>;
	let useCase: ListDelinquentPatientsUseCase;

	const clinicId = '11111111-1111-1111-1111-111111111111';
	const patientOneId = '22222222-2222-2222-2222-222222222221';
	const patientTwoId = '22222222-2222-2222-2222-222222222222';
	const referenceDate = new Date('2026-06-10T15:00:00.000Z');

	const makeCandidate = (input: {
		patientId: string;
		patientName: string;
		installmentId: string;
		debtAgreementId: string;
		dueDate: Date;
		amountCents?: number;
		paidAmountCents?: number;
	}): DelinquentPatientCandidate => ({
		patient: buildPatientEntity({
			id: input.patientId,
			clinicId,
			name: input.patientName,
			preferredChannel: ECommunicationChannel.WhatsApp,
		}),
		debtAgreement: buildDebtAgreementEntity({
			id: input.debtAgreementId,
			clinicId,
			patientId: input.patientId,
		}),
		installment: buildInstallmentEntity({
			id: input.installmentId,
			clinicId,
			debtAgreementId: input.debtAgreementId,
			dueDate: input.dueDate,
			amountCents: input.amountCents ?? 10_000,
			paidAmountCents: input.paidAmountCents ?? 0,
		}),
	});

	beforeEach(() => {
		clinicRepository = makeClinicRepositoryMock();
		delinquentPatientsQueryRepository =
			makeDelinquentPatientsQueryRepositoryMock();
		communicationAttemptRepository = makeCommunicationAttemptRepositoryMock();
		paymentRepository = makePaymentRepositoryMock();
		collectionPriorityScore = makeCollectionPriorityScoreServiceMock();
		collectionRulePolicy = makeCollectionRulePolicyServiceMock();

		useCase = new ListDelinquentPatientsUseCase(
			clinicRepository,
			delinquentPatientsQueryRepository,
			communicationAttemptRepository,
			paymentRepository,
			collectionPriorityScore,
			collectionRulePolicy,
		);

		clinicRepository.findById.mockResolvedValue(
			buildClinicEntity({ id: clinicId }),
		);
		delinquentPatientsQueryRepository.findByClinicId.mockResolvedValue([]);
		communicationAttemptRepository.findByClinicIdAndInstallmentIds.mockResolvedValue(
			[],
		);
		paymentRepository.findByClinicIdAndInstallmentIds.mockResolvedValue([]);
		collectionPriorityScore.calculate.mockReturnValue({
			score: 40,
			reasons: [ECollectionPriorityScoreReason.OverdueDays],
		});
		collectionRulePolicy.decide.mockReturnValue({
			items: [
				{
					type: ECommunicationType.OverdueSoftNotice,
					channel: ECommunicationChannel.WhatsApp,
					status: 'GENERATED',
					skippedReason: null,
				},
			],
		});
	});

	it('should return an empty result when there are no delinquent patients', async () => {
		const output = await useCase.exec({
			clinicId,
			referenceDate,
		});

		expect(output).toEqual({
			items: [],
			total: 0,
			limit: 50,
			offset: 0,
		});
		expect(
			communicationAttemptRepository.findByClinicIdAndInstallmentIds,
		).not.toHaveBeenCalled();
		expect(
			paymentRepository.findByClinicIdAndInstallmentIds,
		).not.toHaveBeenCalled();
	});

	it('should group installments by patient and paginate after aggregation', async () => {
		delinquentPatientsQueryRepository.findByClinicId.mockResolvedValue([
			makeCandidate({
				patientId: patientOneId,
				patientName: 'Ana',
				installmentId: '33333333-3333-3333-3333-333333333331',
				debtAgreementId: '44444444-4444-4444-4444-444444444441',
				dueDate: new Date('2026-05-20T12:00:00.000Z'),
				amountCents: 10_000,
			}),
			makeCandidate({
				patientId: patientOneId,
				patientName: 'Ana',
				installmentId: '33333333-3333-3333-3333-333333333332',
				debtAgreementId: '44444444-4444-4444-4444-444444444441',
				dueDate: new Date('2026-06-01T12:00:00.000Z'),
				amountCents: 20_000,
			}),
			makeCandidate({
				patientId: patientTwoId,
				patientName: 'Bruno',
				installmentId: '33333333-3333-3333-3333-333333333333',
				debtAgreementId: '44444444-4444-4444-4444-444444444442',
				dueDate: new Date('2026-06-08T12:00:00.000Z'),
				amountCents: 5_000,
			}),
		]);
		communicationAttemptRepository.findByClinicIdAndInstallmentIds.mockResolvedValue(
			[
				buildCommunicationAttemptEntity({
					clinicId,
					patientId: patientOneId,
					installmentId: '33333333-3333-3333-3333-333333333331',
					sentAt: new Date('2026-06-09T10:00:00.000Z'),
				}),
				buildCommunicationAttemptEntity({
					clinicId,
					patientId: patientOneId,
					installmentId: '99999999-9999-9999-9999-999999999999',
					sentAt: new Date('2026-06-10T16:00:00.000Z'),
				}),
			],
		);
		paymentRepository.findByClinicIdAndInstallmentIds.mockResolvedValue([
			buildPaymentEntity({
				clinicId,
				installmentId: '33333333-3333-3333-3333-333333333331',
				paidAt: new Date('2026-06-08T13:00:00.000Z'),
			}),
		]);
		collectionPriorityScore.calculate
			.mockReturnValueOnce({
				score: 70,
				reasons: [
					ECollectionPriorityScoreReason.OverdueDays,
					ECollectionPriorityScoreReason.OverdueAmount,
				],
			})
			.mockReturnValueOnce({
				score: 50,
				reasons: [ECollectionPriorityScoreReason.OverdueInstallmentsCount],
			});
		collectionRulePolicy.decide
			.mockReturnValueOnce({
				items: [
					{
						type: ECommunicationType.OverdueFollowUp,
						channel: ECommunicationChannel.WhatsApp,
						status: 'GENERATED',
						skippedReason: null,
					},
				],
			})
			.mockReturnValueOnce({
				items: [
					{
						type: null,
						channel: null,
						status: 'SKIPPED',
						skippedReason: ECollectionRuleSkippedReason.NoRuleForCurrentDate,
					},
				],
			});

		const output = await useCase.exec({
			clinicId,
			referenceDate,
			limit: 1,
			offset: 0,
		});

		expect(output).toEqual({
			items: [
				{
					patientId: patientOneId,
					patientName: 'Ana',
					overdueInstallments: 2,
					totalOverdueCents: 30_000,
					oldestDueDate: new Date('2026-05-20T12:00:00.000Z'),
					daysOverdue: 21,
					priorityScore: 70,
					priorityReasons: [
						ECollectionPriorityScoreReason.OverdueDays,
						ECollectionPriorityScoreReason.OverdueAmount,
					],
					lastCommunicationAt: new Date('2026-06-09T10:00:00.000Z'),
					suggestedAction: ECommunicationType.OverdueFollowUp,
				},
			],
			total: 2,
			limit: 1,
			offset: 0,
		});
		expect(
			collectionPriorityScore.calculate.mock.calls[0]?.[0].installments,
		).toHaveLength(2);
		expect(
			collectionRulePolicy.decide.mock.calls[0]?.[0].installment.id.toString(),
		).toBe('33333333-3333-3333-3333-333333333331');
	});

	it('should return null suggested action when policy has no generated item', async () => {
		delinquentPatientsQueryRepository.findByClinicId.mockResolvedValue([
			makeCandidate({
				patientId: patientOneId,
				patientName: 'Ana',
				installmentId: '33333333-3333-3333-3333-333333333331',
				debtAgreementId: '44444444-4444-4444-4444-444444444441',
				dueDate: new Date('2026-06-03T12:00:00.000Z'),
			}),
		]);
		collectionRulePolicy.decide.mockReturnValue({
			items: [
				{
					type: null,
					channel: null,
					status: 'SKIPPED',
					skippedReason: ECollectionRuleSkippedReason.NoRuleForCurrentDate,
				},
			],
		});

		const output = await useCase.exec({
			clinicId,
			referenceDate,
		});

		expect(output.items[0]?.suggestedAction).toBeNull();
	});

	it('should throw when clinic does not exist', async () => {
		clinicRepository.findById.mockResolvedValue(null);

		await expect(
			useCase.exec({
				clinicId,
				referenceDate,
			}),
		).rejects.toEqual(new ApplicationException('CLINIC_NOT_FOUND'));
	});

	it('should throw when referenceDate is invalid', async () => {
		await expect(
			useCase.exec({
				clinicId,
				referenceDate: new Date('invalid'),
			}),
		).rejects.toEqual(
			new ApplicationException('INVALID_DELINQUENT_PATIENTS_REFERENCE_DATE'),
		);
	});

	it('should throw when pagination is invalid', async () => {
		await expect(
			useCase.exec({
				clinicId,
				referenceDate,
				limit: 0,
			}),
		).rejects.toEqual(
			new ApplicationException('INVALID_DELINQUENT_PATIENTS_PAGINATION'),
		);

		await expect(
			useCase.exec({
				clinicId,
				referenceDate,
				offset: -1,
			}),
		).rejects.toEqual(
			new ApplicationException('INVALID_DELINQUENT_PATIENTS_PAGINATION'),
		);
	});
});
