import { ECollectionPriorityScoreReason } from '../enums/collection-priority-score-reason';
import {
	CollectionPriorityScoreInput,
	CollectionPriorityScoreOutput,
} from '../types/collection-priority-score';

import { CommunicationAttemptEntity } from '@/modules/communications/domain/entities/communication-attempt.entity';
import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { PaymentEntity } from '@/modules/payments/domain/entities/payment.entity';

import { ensureValidDate } from '@/shared/utils/ensure-valid-date';

export class CollectionPriorityScoreDomainService {
	calculate(
		input: CollectionPriorityScoreInput,
	): CollectionPriorityScoreOutput {
		ensureValidDate(
			input.referenceDate,
			'COLLECTION_PRIORITY_REFERENCE_DATE_REQUIRED',
		);

		const overdueInstallments = this.getOverdueInstallments(
			input.installments,
			input.referenceDate,
		);

		if (!overdueInstallments.length) {
			return {
				score: 0,
				reasons: [],
			};
		}

		const maxDaysOverdue = Math.max(
			...overdueInstallments.map((installment) =>
				installment.getDaysOverdue(input.referenceDate),
			),
		);
		const totalOverdueCents = overdueInstallments.reduce(
			(total, installment) =>
				total + installment.getRemainingAmount().getCents(),
			0,
		);
		const overdueCount = overdueInstallments.length;
		const lastCommunicationAt = this.getLastCommunicationAt(
			overdueInstallments,
			input.communicationAttempts,
			input.referenceDate,
		);
		const lastPartialPaymentAt = this.getLastPartialPaymentAt(
			overdueInstallments,
			input.payments,
		);

		const overdueDaysScore = this.scoreDaysOverdue(maxDaysOverdue);
		const overdueAmountScore = this.scoreOverdueAmount(totalOverdueCents);
		const overdueInstallmentsCountScore =
			this.scoreOverdueInstallmentsCount(overdueCount);
		const recentCommunicationPenalty = this.scoreRecentCommunicationPenalty(
			lastCommunicationAt,
			input.referenceDate,
		);
		const recentPartialPaymentPenalty = this.scoreRecentPartialPaymentPenalty(
			lastPartialPaymentAt,
			input.referenceDate,
		);

		const rawScore =
			overdueDaysScore +
			overdueAmountScore +
			overdueInstallmentsCountScore -
			recentCommunicationPenalty -
			recentPartialPaymentPenalty;

		return {
			score: this.clampScore(rawScore),
			reasons: this.resolveReasons({
				overdueDaysScore,
				overdueAmountScore,
				overdueInstallmentsCountScore,
				recentCommunicationPenalty,
				recentPartialPaymentPenalty,
			}),
		};
	}

	private getOverdueInstallments(
		installments: InstallmentEntity[],
		referenceDate: Date,
	): InstallmentEntity[] {
		return installments.filter(
			(installment) =>
				installment.isOverdue(referenceDate) &&
				!installment.isCanceled() &&
				installment.getRemainingAmount().isPositive(),
		);
	}

	private scoreDaysOverdue(daysOverdue: number): number {
		if (daysOverdue <= 0) return 0;
		if (daysOverdue <= 2) return 8;
		if (daysOverdue <= 6) return 16;
		if (daysOverdue <= 14) return 24;
		if (daysOverdue <= 29) return 32;
		return 40;
	}

	private scoreOverdueAmount(totalOverdueCents: number): number {
		if (totalOverdueCents <= 0) return 0;
		if (totalOverdueCents < 10_000) return 5;
		if (totalOverdueCents < 30_000) return 10;
		if (totalOverdueCents < 70_000) return 15;
		if (totalOverdueCents < 150_000) return 20;
		return 25;
	}

	private scoreOverdueInstallmentsCount(count: number): number {
		if (count <= 0) return 0;
		if (count === 1) return 5;
		if (count === 2) return 10;
		return 15;
	}

	private scoreRecentCommunicationPenalty(
		lastCommunicationAt: Date | null,
		referenceDate: Date,
	): number {
		if (!lastCommunicationAt) return 0;

		const days = this.diffInCalendarDays(referenceDate, lastCommunicationAt);
		if (days <= 0) return 15;
		if (days <= 2) return 10;
		if (days <= 6) return 5;
		return 0;
	}

	private scoreRecentPartialPaymentPenalty(
		lastPartialPaymentAt: Date | null,
		referenceDate: Date,
	): number {
		// Priority scoring uses a broader lookback than the delivery policy:
		// recent partial payments reduce urgency for up to 7 days, but they
		// only block a new communication within the policy cooldown window.
		if (!lastPartialPaymentAt) return 0;
		const days = this.diffInCalendarDays(referenceDate, lastPartialPaymentAt);
		if (days <= 0) return 15;
		if (days <= 3) return 10;
		if (days <= 7) return 5;
		return 0;
	}

	private getLastCommunicationAt(
		overdueInstallments: InstallmentEntity[],
		attempts: CommunicationAttemptEntity[],
		referenceDate: Date,
	): Date | null {
		const overdueInstallmentIds = new Set(
			overdueInstallments.map((installment) => installment.id.toString()),
		);
		const effectiveDates = attempts
			.filter((attempt) =>
				overdueInstallmentIds.has(attempt.installmentId.toString()),
			)
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
		if (attempt.sentAt && attempt.sentAt.getTime() <= referenceDate.getTime()) {
			return attempt.sentAt;
		}
		if (attempt.createdAt.getTime() <= referenceDate.getTime()) {
			return attempt.createdAt;
		}
		return null;
	}

	private getLastPartialPaymentAt(
		overdueInstallments: InstallmentEntity[],
		payments: PaymentEntity[],
	): Date | null {
		const overdueInstallmentIds = new Set(
			overdueInstallments.map((installment) => installment.id.toString()),
		);
		const paymentDates = payments
			.filter((payment) =>
				overdueInstallmentIds.has(payment.installmentId.toString()),
			)
			.map((payment) => payment.paidAt)
			.sort((left, right) => right.getTime() - left.getTime());
		return paymentDates[0] ?? null;
	}

	private diffInCalendarDays(referenceDate: Date, targetDate: Date): number {
		const dayInMs = 24 * 60 * 60 * 1000;
		return Math.floor(
			(this.toStartOfDay(referenceDate).getTime() -
				this.toStartOfDay(targetDate).getTime()) /
				dayInMs,
		);
	}

	private toStartOfDay(date: Date): Date {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate());
	}

	private clampScore(score: number): number {
		return Math.min(100, Math.max(0, score));
	}

	private resolveReasons(input: {
		overdueDaysScore: number;
		overdueAmountScore: number;
		overdueInstallmentsCountScore: number;
		recentCommunicationPenalty: number;
		recentPartialPaymentPenalty: number;
	}): ECollectionPriorityScoreReason[] {
		const reasons: ECollectionPriorityScoreReason[] = [];
		if (input.overdueDaysScore > 0) {
			reasons.push(ECollectionPriorityScoreReason.OverdueDays);
		}
		if (input.overdueAmountScore > 0) {
			reasons.push(ECollectionPriorityScoreReason.OverdueAmount);
		}
		if (input.overdueInstallmentsCountScore > 0) {
			reasons.push(ECollectionPriorityScoreReason.OverdueInstallmentsCount);
		}
		if (input.recentCommunicationPenalty > 0) {
			reasons.push(ECollectionPriorityScoreReason.RecentCommunication);
		}
		if (input.recentPartialPaymentPenalty > 0) {
			reasons.push(ECollectionPriorityScoreReason.RecentPartialPayment);
		}
		return reasons;
	}
}
