import { EntityId } from '@/@core/domain/entities/entity-id';
import { ECommunicationType } from '@/@core/enums/domain';
import { ECollectionPriorityScoreReason } from '@/modules/collections/domain/enums/collection-priority-score-reason';
import { ECollectionRuleSkippedReason } from '@/modules/collections/domain/enums/collection-rule-skipped-reason';

export type DashboardPriorityQueueItem = {
	patientId: string;
	patientName: string;
	totalOverdueCents: number;
	overdueInstallments: number;
	daysOverdue: number;
	priorityScore: number;
	priorityReasons: ECollectionPriorityScoreReason[];
	lastCommunicationAt: Date | null;
	suggestedAction: ECommunicationType | null;
	suggestedActionSkippedReason: ECollectionRuleSkippedReason | null;
};

export type DashboardSummary = {
	clinicId: string;
	referenceDate: Date;
	receivables: {
		totalDebtAmountCents: number;
		totalPaidAmountCents: number;
		totalOpenAmountCents: number;
		totalOverdueAmountCents: number;
	};
	agreements: {
		total: number;
		active: number;
		canceled: number;
		fullyPaid: number;
	};
	installments: {
		total: number;
		open: number;
		paid: number;
		partiallyPaid: number;
		overdue: number;
		dueToday: number;
		dueSoon: number;
	};
	patients: {
		total: number;
		withOpenDebt: number;
		delinquent: number;
		doNotContact: number;
		missingContactInfo: number;
	};
	collections: {
		totalAttempts: number;
		generatedToday: number;
		byChannel: {
			whatsapp: number;
			email: number;
		};
		byType: {
			preDueReminder: number;
			dueDateReminder: number;
			overdueSoftNotice: number;
			overdueFollowUp: number;
			overdueEscalation: number;
		};
	};
	payments: {
		totalPayments: number;
		paidAmountLast7DaysCents: number;
		paidAmountLast30DaysCents: number;
	};
	priority: {
		topDelinquentPatients: DashboardPriorityQueueItem[];
	};
};

export abstract class DashboardSummaryQueryRepository {
	abstract getByClinicIdAndReferenceDate(
		clinicId: EntityId,
		referenceDate: Date,
	): Promise<DashboardSummary>;
}
