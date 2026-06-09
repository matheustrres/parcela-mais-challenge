import { beforeEach, describe, expect, it } from 'vitest';
import { MockProxy } from 'vitest-mock-extended';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { TransactionManager } from '@/@core/application/transaction-manager';
import {
	ECommunicationChannel,
	ECommunicationType,
} from '@/@core/enums/domain';

import { ClinicRepository } from '@/modules/clinics/application/repositories/clinic.repository';
import {
	CollectionCandidate,
	CollectionCandidateRepository,
} from '@/modules/collections/application/repositories/collection-candidate.repository';
import { RunCollectionRulesUseCase } from '@/modules/collections/application/use-cases/run-collection-rules.use-case';
import { ECollectionRuleSkippedReason } from '@/modules/collections/domain/enums/collection-rule-skipped-reason';
import { CollectionRulePolicyDomainService } from '@/modules/collections/domain/services/collection-rule-policy.service';
import { CollectionCommunicationMessageFactoryDomainService } from '@/modules/collections/domain/services/collections-communication-message-factory.service';
import { CommunicationAttemptRepository } from '@/modules/communications/application/repositories/communication-attempt.repository';
import { PaymentRepository } from '@/modules/payments/application/repositories/payment.repository';

import { buildClinicEntity } from '#/data/builders/entities/clinic.entity.builder';
import { buildDebtAgreementEntity } from '#/data/builders/entities/debt-agreement.entity.builder';
import { buildInstallmentEntity } from '#/data/builders/entities/installment.entity.builder';
import { buildPatientEntity } from '#/data/builders/entities/patient.entity.builder';
import { makeClinicRepositoryMock } from '#/data/mocks/repositories/clinic.repository.mock';
import { makeCollectionCandidateRepositoryMock } from '#/data/mocks/repositories/collection-candidate.repository.mock';
import { makeCommunicationAttemptRepositoryMock } from '#/data/mocks/repositories/communication-attempt.repository.mock';
import { makePaymentRepositoryMock } from '#/data/mocks/repositories/payment.repository.mock';
import { makeCollectionCommunicationMessageFactoryServiceMock } from '#/data/mocks/services/collection-communication-message-factory.service.mock';
import { makeCollectionRulePolicyServiceMock } from '#/data/mocks/services/collection-rule-policy.service.mock';
import {
	makeTransactionManagerMock,
	TransactionManagerMockBundle,
} from '#/data/mocks/services/transaction-manager.mock';

describe('RunCollectionRulesUseCase', () => {
	let clinicRepository: MockProxy<ClinicRepository>;
	let collectionCandidateRepository: MockProxy<CollectionCandidateRepository>;
	let communicationAttemptRepository: MockProxy<CommunicationAttemptRepository>;
	let paymentRepository: MockProxy<PaymentRepository>;
	let collectionRulePolicy: MockProxy<CollectionRulePolicyDomainService>;
	let communicationMessageFactory: MockProxy<CollectionCommunicationMessageFactoryDomainService>;
	let transactionManagerBundle: TransactionManagerMockBundle;
	let useCase: RunCollectionRulesUseCase;

	const clinicId = 'clinic-1';
	const referenceDate = new Date('2024-04-17T13:00:00.000Z');

	const makeCandidate = (): CollectionCandidate => ({
		installment: buildInstallmentEntity({
			id: 'installment-1',
			clinicId,
			debtAgreementId: 'debt-agreement-1',
		}),
		patient: buildPatientEntity({
			id: 'patient-1',
			clinicId,
			preferredChannel: ECommunicationChannel.WhatsApp,
		}),
		debtAgreement: buildDebtAgreementEntity({
			id: 'debt-agreement-1',
			clinicId,
			patientId: 'patient-1',
		}),
	});

	beforeEach(() => {
		clinicRepository = makeClinicRepositoryMock();
		collectionCandidateRepository = makeCollectionCandidateRepositoryMock();
		communicationAttemptRepository = makeCommunicationAttemptRepositoryMock();
		paymentRepository = makePaymentRepositoryMock();
		collectionRulePolicy = makeCollectionRulePolicyServiceMock();
		communicationMessageFactory =
			makeCollectionCommunicationMessageFactoryServiceMock();
		transactionManagerBundle = makeTransactionManagerMock();

		useCase = new RunCollectionRulesUseCase(
			clinicRepository,
			collectionCandidateRepository,
			communicationAttemptRepository,
			paymentRepository,
			collectionRulePolicy,
			communicationMessageFactory,
			transactionManagerBundle.transactionManager as TransactionManager,
		);

		clinicRepository.findById.mockResolvedValue(
			buildClinicEntity({ id: clinicId }),
		);
		collectionCandidateRepository.findByClinicIdForRuleEvaluation.mockResolvedValue(
			[],
		);
		communicationAttemptRepository.findRelevantForCollectionRun.mockResolvedValue(
			[],
		);
		communicationAttemptRepository.createMany.mockResolvedValue();
		paymentRepository.findByClinicIdAndInstallmentIdsPaidSince.mockResolvedValue(
			[],
		);
		communicationMessageFactory.createMessage.mockReturnValue({
			message: 'Mensagem gerada',
			templateKey: 'collection.template.v1',
			aiGenerated: false,
		});
	});

	it('should return zeros when there are no candidates', async () => {
		const output = await useCase.exec({
			clinicId,
			referenceDate,
		});

		expect(output).toEqual({
			generated: 0,
			skipped: 0,
			items: [],
		});
		expect(communicationAttemptRepository.createMany).not.toHaveBeenCalled();
		expect(
			transactionManagerBundle.transactionManager.run,
		).not.toHaveBeenCalled();
	});

	it('should generate one pre due reminder and persist it in a transaction', async () => {
		const candidate = makeCandidate();
		collectionCandidateRepository.findByClinicIdForRuleEvaluation.mockResolvedValue(
			[candidate],
		);
		collectionRulePolicy.decide.mockReturnValue({
			items: [
				{
					type: ECommunicationType.PreDueReminder,
					channel: ECommunicationChannel.WhatsApp,
					status: 'GENERATED',
					skippedReason: null,
				},
			],
		});

		const output = await useCase.exec({
			clinicId,
			referenceDate,
		});

		expect(
			transactionManagerBundle.transactionManager.run,
		).toHaveBeenCalledOnce();
		expect(communicationMessageFactory.createMessage).toHaveBeenCalledWith({
			patient: candidate.patient,
			installment: candidate.installment,
			type: ECommunicationType.PreDueReminder,
			channel: ECommunicationChannel.WhatsApp,
			referenceDate,
		});
		expect(communicationAttemptRepository.createMany).toHaveBeenCalledOnce();
		const [attempts] = communicationAttemptRepository.createMany.mock.calls[0]!;
		expect(attempts).toHaveLength(1);
		expect(attempts[0]?.scheduledFor).toEqual(referenceDate);
		expect(attempts[0]?.status).toBe('GENERATED');
		expect(output.generated).toBe(1);
		expect(output.skipped).toBe(0);
		expect(output.items[0]?.message).toBe('Mensagem gerada');
	});

	it('should return mixed generated and skipped items on D+7 and persist only generated attempts', async () => {
		const candidate = makeCandidate();
		collectionCandidateRepository.findByClinicIdForRuleEvaluation.mockResolvedValue(
			[candidate],
		);
		collectionRulePolicy.decide.mockReturnValue({
			items: [
				{
					type: ECommunicationType.OverdueFollowUp,
					channel: ECommunicationChannel.WhatsApp,
					status: 'GENERATED',
					skippedReason: null,
				},
				{
					type: ECommunicationType.OverdueFollowUp,
					channel: ECommunicationChannel.Email,
					status: 'SKIPPED',
					skippedReason:
						ECollectionRuleSkippedReason.CommunicationTypeAlreadyExists,
				},
			],
		});

		const output = await useCase.exec({
			clinicId,
			referenceDate,
		});

		expect(communicationMessageFactory.createMessage).toHaveBeenCalledOnce();
		const [attempts] = communicationAttemptRepository.createMany.mock.calls[0]!;
		expect(attempts).toHaveLength(1);
		expect(output.generated).toBe(1);
		expect(output.skipped).toBe(1);
		expect(output.items).toEqual([
			{
				installmentId: 'installment-1',
				patientId: 'patient-1',
				type: ECommunicationType.OverdueFollowUp,
				channel: ECommunicationChannel.WhatsApp,
				status: 'GENERATED',
				skippedReason: null,
				message: 'Mensagem gerada',
			},
			{
				installmentId: 'installment-1',
				patientId: 'patient-1',
				type: ECommunicationType.OverdueFollowUp,
				channel: ECommunicationChannel.Email,
				status: 'SKIPPED',
				skippedReason:
					ECollectionRuleSkippedReason.CommunicationTypeAlreadyExists,
				message: null,
			},
		]);
	});

	it('should throw when clinic is not found', async () => {
		clinicRepository.findById.mockResolvedValue(null);

		await expect(
			useCase.exec({
				clinicId,
				referenceDate,
			}),
		).rejects.toThrowError(new ApplicationException('CLINIC_NOT_FOUND'));
	});

	it('should throw when reference date is invalid', async () => {
		await expect(
			useCase.exec({
				clinicId,
				referenceDate: new Date('invalid'),
			}),
		).rejects.toThrowError(
			new ApplicationException('INVALID_COLLECTION_REFERENCE_DATE'),
		);
	});

	it('should propagate persistence error from communication attempt repository', async () => {
		const candidate = makeCandidate();
		collectionCandidateRepository.findByClinicIdForRuleEvaluation.mockResolvedValue(
			[candidate],
		);
		collectionRulePolicy.decide.mockReturnValue({
			items: [
				{
					type: ECommunicationType.PreDueReminder,
					channel: ECommunicationChannel.WhatsApp,
					status: 'GENERATED',
					skippedReason: null,
				},
			],
		});
		communicationAttemptRepository.createMany.mockRejectedValue(
			new Error('db down'),
		);

		await expect(
			useCase.exec({
				clinicId,
				referenceDate,
			}),
		).rejects.toThrowError(new Error('db down'));
	});
});
