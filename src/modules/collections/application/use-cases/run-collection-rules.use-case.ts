import { Injectable } from '@nestjs/common';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { TransactionManager } from '@/@core/application/transaction-manager';
import { UseCase } from '@/@core/application/use-case';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import {
	ECommunicationChannel,
	ECommunicationStatus,
	ECommunicationType,
} from '@/@core/enums/domain';

import { ClinicRepository } from '@/modules/clinics/application/repositories/clinic.repository';
import { CollectionCandidateRepository } from '@/modules/collections/application/repositories/collection-candidate.repository';
import { CollectionRulePolicyDomainService } from '@/modules/collections/domain/services/collection-rule-policy.service';
import { CollectionCommunicationMessageFactoryDomainService } from '@/modules/collections/domain/services/collections-communication-message-factory.service';
import { CommunicationAttemptRepository } from '@/modules/communications/application/repositories/communication-attempt.repository';
import { CommunicationAttemptEntity } from '@/modules/communications/domain/entities/communication-attempt.entity';
import { PaymentRepository } from '@/modules/payments/application/repositories/payment.repository';

export type RunCollectionRulesInput = {
	clinicId: string;
	referenceDate: Date;
};

export type RunCollectionRulesOutput = {
	generated: number;
	skipped: number;
	items: {
		installmentId: string;
		patientId: string;
		type: ECommunicationType | null;
		channel: ECommunicationChannel | null;
		status: 'GENERATED' | 'SKIPPED';
		skippedReason: string | null;
		message: string | null;
	}[];
};

@Injectable()
export class RunCollectionRulesUseCase implements UseCase<
	RunCollectionRulesInput,
	RunCollectionRulesOutput
> {
	constructor(
		private readonly clinicRepository: ClinicRepository,
		private readonly collectionCandidateRepository: CollectionCandidateRepository,
		private readonly communicationAttemptRepository: CommunicationAttemptRepository,
		private readonly paymentRepository: PaymentRepository,
		private readonly collectionRulePolicy: CollectionRulePolicyDomainService,
		private readonly communicationMessageFactory: CollectionCommunicationMessageFactoryDomainService,
		private readonly transactionManager: TransactionManager,
	) {}

	async exec(
		input: RunCollectionRulesInput,
	): Promise<RunCollectionRulesOutput> {
		const clinicId = EntityUuid.createFrom(input.clinicId);
		const referenceDate = this.ensureValidReferenceDate(input.referenceDate);

		const clinic = await this.clinicRepository.findById(clinicId);
		if (!clinic) {
			throw new ApplicationException('CLINIC_NOT_FOUND');
		}

		const candidates =
			await this.collectionCandidateRepository.findByClinicIdForRuleEvaluation(
				clinicId,
			);
		if (!candidates.length) {
			return {
				generated: 0,
				skipped: 0,
				items: [],
			};
		}

		const installmentIds = candidates.map(({ installment }) => installment.id);
		const patientIds = candidates.map(({ patient }) => patient.id);
		const [previousAttempts, recentPayments] = await Promise.all([
			this.communicationAttemptRepository.findRelevantForCollectionRun({
				clinicId,
				installmentIds,
				patientIds,
			}),
			this.paymentRepository.findByClinicIdAndInstallmentIdsPaidSince({
				clinicId,
				installmentIds,
				paidSince: new Date(referenceDate.getTime() - 24 * 60 * 60 * 1000),
			}),
		]);

		const outputItems: RunCollectionRulesOutput['items'] = [];
		const attemptsToCreate: CommunicationAttemptEntity[] = [];

		for (const candidate of candidates) {
			const candidateAttempts = previousAttempts.filter(
				(attempt) =>
					attempt.installmentId.equals(candidate.installment.id) ||
					attempt.patientId.equals(candidate.patient.id),
			);
			const candidateRecentPayments = recentPayments.filter((payment) =>
				payment.installmentId.equals(candidate.installment.id),
			);
			const decision = this.collectionRulePolicy.decide({
				patient: candidate.patient,
				installment: candidate.installment,
				debtAgreement: candidate.debtAgreement,
				previousAttempts: candidateAttempts,
				recentPayments: candidateRecentPayments,
				referenceDate,
			});

			for (const item of decision.items) {
				if (item.status === 'SKIPPED') {
					outputItems.push({
						installmentId: candidate.installment.id.toString(),
						patientId: candidate.patient.id.toString(),
						type: item.type,
						channel: item.channel,
						status: 'SKIPPED',
						skippedReason: item.skippedReason,
						message: null,
					});
					continue;
				}

				const message = this.communicationMessageFactory.createMessage({
					patient: candidate.patient,
					installment: candidate.installment,
					type: item.type as ECommunicationType,
					channel: item.channel as ECommunicationChannel,
					referenceDate,
				});

				const attempt = CommunicationAttemptEntity.create({
					clinicId,
					patientId: candidate.patient.id,
					installmentId: candidate.installment.id,
					type: item.type as ECommunicationType,
					channel: item.channel as ECommunicationChannel,
					status: ECommunicationStatus.Generated,
					scheduledFor: referenceDate,
					sentAt: null,
					skippedReason: null,
					message: message.message,
					aiGenerated: message.aiGenerated,
					templateKey: message.templateKey,
				});

				attemptsToCreate.push(attempt);
				outputItems.push({
					installmentId: candidate.installment.id.toString(),
					patientId: candidate.patient.id.toString(),
					type: attempt.type,
					channel: attempt.channel,
					status: 'GENERATED',
					skippedReason: null,
					message: attempt.message,
				});
			}
		}

		if (attemptsToCreate.length > 0) {
			await this.transactionManager.run(async (tx) => {
				await this.communicationAttemptRepository.createMany(
					attemptsToCreate,
					tx,
				);
			});
		}

		return {
			generated: outputItems.filter((item) => item.status === 'GENERATED')
				.length,
			skipped: outputItems.filter((item) => item.status === 'SKIPPED').length,
			items: outputItems,
		};
	}

	private ensureValidReferenceDate(referenceDate: Date): Date {
		if (
			!(referenceDate instanceof Date) ||
			Number.isNaN(referenceDate.getTime())
		) {
			throw new ApplicationException('INVALID_COLLECTION_REFERENCE_DATE');
		}
		return referenceDate;
	}
}
