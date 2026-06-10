import { Injectable } from '@nestjs/common';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { UseCase } from '@/@core/application/use-case';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { ECommunicationType } from '@/@core/enums/domain';

import { ClinicRepository } from '@/modules/clinics/application/repositories/clinic.repository';
import {
	DelinquentPatientCandidate,
	DelinquentPatientsQueryRepository,
} from '@/modules/collections/application/repositories/delinquent-patients-query.repository';
import { ECollectionPriorityScoreReason } from '@/modules/collections/domain/enums/collection-priority-score-reason';
import { ECollectionRuleSkippedReason } from '@/modules/collections/domain/enums/collection-rule-skipped-reason';
import { CollectionPriorityScoreDomainService } from '@/modules/collections/domain/services/collection-priority-score.service';
import { CollectionRulePolicyDomainService } from '@/modules/collections/domain/services/collection-rule-policy.service';
import { CommunicationAttemptRepository } from '@/modules/communications/application/repositories/communication-attempt.repository';
import { CommunicationAttemptEntity } from '@/modules/communications/domain/entities/communication-attempt.entity';
import { PaymentRepository } from '@/modules/payments/application/repositories/payment.repository';
import { PaymentEntity } from '@/modules/payments/domain/entities/payment.entity';

export type ListDelinquentPatientsInput = {
	clinicId: string;
	referenceDate: Date;
	limit?: number;
	offset?: number;
};

export type DelinquentPatientOutput = {
	patientId: string;
	patientName: string;
	overdueInstallments: number;
	totalOverdueCents: number;
	oldestDueDate: Date;
	daysOverdue: number;
	priorityScore: number;
	priorityReasons: ECollectionPriorityScoreReason[];
	lastCommunicationAt: Date | null;
	suggestedAction: ECommunicationType | null;
	suggestedActionSkippedReason: ECollectionRuleSkippedReason | null;
};

export type ListDelinquentPatientsOutput = {
	items: DelinquentPatientOutput[];
	total: number;
	limit: number;
	offset: number;
};

type PatientGroup = {
	candidates: DelinquentPatientCandidate[];
};

@Injectable()
export class ListDelinquentPatientsUseCase implements UseCase<
	ListDelinquentPatientsInput,
	ListDelinquentPatientsOutput
> {
	constructor(
		private readonly clinicRepository: ClinicRepository,
		private readonly delinquentPatientsQueryRepository: DelinquentPatientsQueryRepository,
		private readonly communicationAttemptRepository: CommunicationAttemptRepository,
		private readonly paymentRepository: PaymentRepository,
		private readonly collectionPriorityScore: CollectionPriorityScoreDomainService,
		private readonly collectionRulePolicy: CollectionRulePolicyDomainService,
	) {}

	async exec(
		input: ListDelinquentPatientsInput,
	): Promise<ListDelinquentPatientsOutput> {
		const clinicId = EntityUuid.createFrom(input.clinicId);
		const referenceDate = this.ensureValidReferenceDate(input.referenceDate);
		const limit = this.ensureValidLimit(input.limit);
		const offset = this.ensureValidOffset(input.offset);

		const clinic = await this.clinicRepository.findById(clinicId);
		if (!clinic) {
			throw new ApplicationException('CLINIC_NOT_FOUND');
		}

		const candidates =
			await this.delinquentPatientsQueryRepository.findByClinicId(
				clinicId,
				referenceDate,
			);

		if (!candidates.length) {
			return {
				items: [],
				total: 0,
				limit,
				offset,
			};
		}

		const installmentIds = this.uniqueEntityIds(
			candidates.map(({ installment }) => installment.id.toString()),
		);
		const [attempts, payments] = await Promise.all([
			this.communicationAttemptRepository.findByClinicIdAndInstallmentIds(
				clinicId,
				installmentIds,
			),
			this.paymentRepository.findByClinicIdAndInstallmentIds(
				clinicId,
				installmentIds,
			),
		]);

		const groupedItems = Array.from(this.groupByPatient(candidates).values())
			.map((group) =>
				this.toOutputItem({
					group,
					attempts,
					payments,
					referenceDate,
				}),
			)
			.sort((left, right) => {
				if (right.priorityScore !== left.priorityScore) {
					return right.priorityScore - left.priorityScore;
				}
				if (right.daysOverdue !== left.daysOverdue) {
					return right.daysOverdue - left.daysOverdue;
				}
				if (right.totalOverdueCents !== left.totalOverdueCents) {
					return right.totalOverdueCents - left.totalOverdueCents;
				}
				return left.patientName.localeCompare(right.patientName);
			});

		return {
			items: groupedItems.slice(offset, offset + limit),
			total: groupedItems.length,
			limit,
			offset,
		};
	}

	private toOutputItem(input: {
		group: PatientGroup;
		attempts: CommunicationAttemptEntity[];
		payments: PaymentEntity[];
		referenceDate: Date;
	}): DelinquentPatientOutput {
		const overdueCandidates = input.group.candidates.filter(({ installment }) =>
			installment.isOverdue(input.referenceDate),
		);
		const overdueInstallments = overdueCandidates.map(
			({ installment }) => installment,
		);
		const installmentIds = new Set(
			overdueInstallments.map((installment) => installment.id.toString()),
		);
		const overdueAttempts = input.attempts.filter((attempt) =>
			installmentIds.has(attempt.installmentId.toString()),
		);
		const overduePayments = input.payments.filter((payment) =>
			installmentIds.has(payment.installmentId.toString()),
		);
		const oldestCandidate = [...overdueCandidates].sort((left, right) => {
			const byDueDate =
				left.installment.dueDate.getTime() -
				right.installment.dueDate.getTime();
			if (byDueDate !== 0) {
				return byDueDate;
			}
			return (
				left.installment.installmentNumber - right.installment.installmentNumber
			);
		})[0]!;
		const totalOverdueCents = overdueInstallments.reduce(
			(total, installment) =>
				total + installment.getRemainingAmount().getCents(),
			0,
		);
		const daysOverdue = Math.max(
			...overdueInstallments.map((installment) =>
				installment.getDaysOverdue(input.referenceDate),
			),
		);
		const priority = this.collectionPriorityScore.calculate({
			installments: overdueInstallments,
			communicationAttempts: overdueAttempts,
			payments: overduePayments,
			referenceDate: input.referenceDate,
		});
		const suggestedDecision = this.collectionRulePolicy.decide({
			patient: oldestCandidate.patient,
			debtAgreement: oldestCandidate.debtAgreement,
			installment: oldestCandidate.installment,
			previousAttempts: overdueAttempts,
			recentPayments: overduePayments,
			referenceDate: input.referenceDate,
		});

		return {
			patientId: oldestCandidate.patient.id.toString(),
			patientName: oldestCandidate.patient.name,
			overdueInstallments: overdueInstallments.length,
			totalOverdueCents,
			oldestDueDate: oldestCandidate.installment.dueDate,
			daysOverdue,
			priorityScore: priority.score,
			priorityReasons: priority.reasons,
			lastCommunicationAt: this.getLastCommunicationAt(
				overdueAttempts,
				input.referenceDate,
			),
			suggestedAction:
				suggestedDecision.items.find((item) => item.status === 'GENERATED')
					?.type ?? null,
			suggestedActionSkippedReason:
				suggestedDecision.items.find((item) => item.status === 'GENERATED')
					?.skippedReason ??
				suggestedDecision.items[0]?.skippedReason ??
				null,
		};
	}

	private groupByPatient(
		candidates: DelinquentPatientCandidate[],
	): Map<string, PatientGroup> {
		return candidates.reduce((groups, candidate) => {
			const patientId = candidate.patient.id.toString();
			const current = groups.get(patientId) ?? { candidates: [] };
			current.candidates.push(candidate);
			groups.set(patientId, current);
			return groups;
		}, new Map<string, PatientGroup>());
	}

	private getLastCommunicationAt(
		attempts: CommunicationAttemptEntity[],
		referenceDate: Date,
	): Date | null {
		const effectiveDates = attempts
			.map((attempt) =>
				this.getCommunicationEffectiveAt(attempt, referenceDate),
			)
			.filter((date): date is Date => date !== null)
			.sort((left, right) => right.getTime() - left.getTime());

		return effectiveDates[0] ?? null;
	}

	private getCommunicationEffectiveAt(
		attempt: CommunicationAttemptEntity,
		referenceDate: Date,
	): Date | null {
		const effectiveAt = attempt.sentAt ?? attempt.scheduledFor ?? attempt.createdAt;
		if (effectiveAt.getTime() > referenceDate.getTime()) {
			return null;
		}
		return effectiveAt;
	}

	private uniqueEntityIds(ids: string[]) {
		return [...new Set(ids)].map((id) => EntityUuid.createFrom(id));
	}

	private ensureValidReferenceDate(referenceDate: Date): Date {
		if (
			!(referenceDate instanceof Date) ||
			Number.isNaN(referenceDate.getTime())
		) {
			throw new ApplicationException(
				'INVALID_DELINQUENT_PATIENTS_REFERENCE_DATE',
			);
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
			throw new ApplicationException('INVALID_DELINQUENT_PATIENTS_PAGINATION');
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
			throw new ApplicationException('INVALID_DELINQUENT_PATIENTS_PAGINATION');
		}
		return resolvedOffset;
	}
}
