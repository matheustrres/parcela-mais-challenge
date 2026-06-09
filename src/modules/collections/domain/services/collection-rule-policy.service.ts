import { ECollectionRuleSkippedReason } from '../enums/collection-rule-skipped-reason';
import {
	CollectionRuleDecision,
	CollectionRuleDecisionItem,
} from '../types/collection-rule-decision';

import {
	ECommunicationChannel,
	ECommunicationType,
	EContactStatus,
} from '@/@core/enums/domain';

import { CommunicationAttemptEntity } from '@/modules/communications/domain/entities/communication-attempt.entity';
import { DebtAgreementEntity } from '@/modules/debt-agreements/domain/entities/debt-agreement.entity';
import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { PatientEntity } from '@/modules/patients/domain/entities/patient.entity';
import { PaymentEntity } from '@/modules/payments/domain/entities/payment.entity';

import { ensureValidDate } from '@/shared/utils/ensure-valid-date';

type CollectionRulePolicyInput = {
	patient: PatientEntity;
	installment: InstallmentEntity;
	debtAgreement: DebtAgreementEntity;
	previousAttempts: CommunicationAttemptEntity[];
	recentPayments: PaymentEntity[];
	referenceDate: Date;
};

type CollectionRuleDecisionGuards = {
	isInstallmentPaid: boolean;
	isInstallmentCanceled: boolean;
	isDebtAgreementCanceled: boolean;
	isPatientDoNotContact: boolean;
	isPatientMissingContactInfo: boolean;
	availableChannels: ECommunicationChannel[];
	isWithinBusinessHours: boolean;
	ruleType: ECommunicationType | null;
	hasPatientAttemptToday: boolean;
	hasRecentPartialPayment: boolean;
	firstSkippedReason: ECollectionRuleSkippedReason | null;
};

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 18;

export class CollectionRulePolicyDomainService {
	decide(input: CollectionRulePolicyInput): CollectionRuleDecision {
		ensureValidDate(
			input.referenceDate,
			'COLLECTION_RULE_REFERENCE_DATE_REQUIRED',
		);

		const guardChecks = this.buildDecisionGuards(input);

		if (guardChecks.firstSkippedReason) {
			return this.globalSkip(guardChecks.firstSkippedReason);
		}

		const ruleType = guardChecks.ruleType as ECommunicationType;
		const channelEligibleActions = this.filterAvailableChannels(
			input.patient,
			this.resolveActionsForType(ruleType),
		);
		if (!channelEligibleActions.length) {
			return this.globalSkip(
				ECollectionRuleSkippedReason.PatientMissingContactInfo,
			);
		}

		const items = this.buildActionDecisionItems(
			input.previousAttempts,
			input.installment,
			channelEligibleActions,
		);

		return { items };
	}

	private buildDecisionGuards(
		input: CollectionRulePolicyInput,
	): CollectionRuleDecisionGuards {
		const guards = {
			isInstallmentPaid: input.installment.isPaid(),
			isInstallmentCanceled: input.installment.isCanceled(),
			isDebtAgreementCanceled: input.debtAgreement.isCanceled(),
			isPatientDoNotContact:
				input.patient.contactStatus === EContactStatus.DoNotContact,
			isPatientMissingContactInfo:
				input.patient.contactStatus === EContactStatus.MissingContactInfo,
			availableChannels: this.getAvailableChannels(input.patient),
			isWithinBusinessHours: this.isWithinBusinessHours(input.referenceDate),
			ruleType: this.resolveRuleType(input.installment, input.referenceDate),
			hasPatientAttemptToday: this.hasPatientAttemptToday(
				input.previousAttempts,
				input.patient,
				input.referenceDate,
			),
			hasRecentPartialPayment: this.hasRecentPartialPayment(
				input.recentPayments,
				input.installment,
			),
		};

		const skipRules = [
			{
				when: guards.isInstallmentPaid,
				reason: ECollectionRuleSkippedReason.InstallmentAlreadyPaid,
			},
			{
				when: guards.isInstallmentCanceled,
				reason: ECollectionRuleSkippedReason.InstallmentCanceled,
			},
			{
				when: guards.isDebtAgreementCanceled,
				reason: ECollectionRuleSkippedReason.DebtAgreementCanceled,
			},
			{
				when: guards.isPatientDoNotContact,
				reason: ECollectionRuleSkippedReason.PatientDoNotContact,
			},
			{
				when:
					guards.isPatientMissingContactInfo ||
					guards.availableChannels.length === 0,
				reason: ECollectionRuleSkippedReason.PatientMissingContactInfo,
			},
			{
				when: !guards.isWithinBusinessHours,
				reason: ECollectionRuleSkippedReason.OutsideBusinessHours,
			},
			{
				when: guards.ruleType === null,
				reason: ECollectionRuleSkippedReason.NoRuleForCurrentDate,
			},
			{
				when: guards.hasPatientAttemptToday,
				reason: ECollectionRuleSkippedReason.PatientAlreadyContactedToday,
			},
			{
				when: guards.hasRecentPartialPayment,
				reason: ECollectionRuleSkippedReason.RecentPartialPayment,
			},
		] as const;

		const firstSkippedReason =
			skipRules.find((rule) => rule.when)?.reason ?? null;

		return {
			...guards,
			firstSkippedReason,
		};
	}

	private globalSkip(
		skippedReason: ECollectionRuleSkippedReason,
	): CollectionRuleDecision {
		return {
			items: [
				{
					type: null,
					channel: null,
					status: 'SKIPPED',
					skippedReason,
				},
			],
		};
	}

	private resolveRuleType(
		installment: InstallmentEntity,
		referenceDate: Date,
	): ECommunicationType | null {
		const dayDiff = this.getBusinessDayDiff(referenceDate, installment.dueDate);

		if (dayDiff === -3) {
			return ECommunicationType.PreDueReminder;
		}
		if (dayDiff === 0) {
			return ECommunicationType.DueDateReminder;
		}
		if (dayDiff === 2) {
			return ECommunicationType.OverdueSoftNotice;
		}
		if (dayDiff === 7) {
			return ECommunicationType.OverdueFollowUp;
		}
		if (dayDiff === 15) {
			return ECommunicationType.OverdueEscalation;
		}

		return null;
	}

	private resolveActionsForType(
		type: ECommunicationType,
	): Array<Pick<CollectionRuleDecisionItem, 'type' | 'channel'>> {
		if (type === ECommunicationType.PreDueReminder) {
			return [{ type, channel: ECommunicationChannel.WhatsApp }];
		}
		if (type === ECommunicationType.DueDateReminder) {
			return [{ type, channel: ECommunicationChannel.WhatsApp }];
		}
		if (type === ECommunicationType.OverdueSoftNotice) {
			return [{ type, channel: ECommunicationChannel.WhatsApp }];
		}
		if (type === ECommunicationType.OverdueFollowUp) {
			return [
				{ type, channel: ECommunicationChannel.WhatsApp },
				{ type, channel: ECommunicationChannel.Email },
			];
		}
		if (type === ECommunicationType.OverdueEscalation) {
			return [{ type, channel: ECommunicationChannel.Email }];
		}

		return [];
	}

	private filterAvailableChannels(
		patient: PatientEntity,
		actions: Array<Pick<CollectionRuleDecisionItem, 'type' | 'channel'>>,
	): Array<Pick<CollectionRuleDecisionItem, 'type' | 'channel'>> {
		return actions.filter((action) =>
			this.patientCanReceiveChannel(
				patient,
				action.channel as ECommunicationChannel,
			),
		);
	}

	private buildActionDecisionItems(
		previousAttempts: CommunicationAttemptEntity[],
		installment: InstallmentEntity,
		actions: Array<Pick<CollectionRuleDecisionItem, 'type' | 'channel'>>,
	): CollectionRuleDecisionItem[] {
		return actions.map((action) => {
			const alreadyExists = previousAttempts.some(
				(attempt) =>
					attempt.installmentId.equals(installment.id) &&
					attempt.type === action.type &&
					attempt.channel === action.channel,
			);

			if (alreadyExists) {
				return {
					type: action.type,
					channel: action.channel,
					status: 'SKIPPED',
					skippedReason:
						ECollectionRuleSkippedReason.CommunicationTypeAlreadyExists,
				};
			}

			return {
				type: action.type,
				channel: action.channel,
				status: 'GENERATED',
				skippedReason: null,
			};
		});
	}

	private hasRecentPartialPayment(
		recentPayments: PaymentEntity[],
		installment: InstallmentEntity,
	): boolean {
		return recentPayments.some((payment) =>
			payment.installmentId.equals(installment.id),
		);
	}

	private hasPatientAttemptToday(
		previousAttempts: CommunicationAttemptEntity[],
		patient: PatientEntity,
		referenceDate: Date,
	): boolean {
		const referenceDayKey = this.getBusinessDayKey(referenceDate);

		return previousAttempts.some((attempt) => {
			if (!attempt.patientId.equals(patient.id)) {
				return false;
			}

			const occurredAt =
				attempt.sentAt ?? attempt.scheduledFor ?? attempt.createdAt;
			return this.getBusinessDayKey(occurredAt) === referenceDayKey;
		});
	}

	private isWithinBusinessHours(referenceDate: Date): boolean {
		const { hour } = this.getSaoPauloDateParts(referenceDate);
		return hour >= BUSINESS_START_HOUR && hour < BUSINESS_END_HOUR;
	}

	private getBusinessDayDiff(referenceDate: Date, dueDate: Date): number {
		const referenceDay = this.getBusinessDayStartTimestamp(referenceDate);
		const dueBusinessDay = this.getBusinessDayStartTimestamp(dueDate);
		const dayInMs = 24 * 60 * 60 * 1000;

		return Math.floor((referenceDay - dueBusinessDay) / dayInMs);
	}

	private getBusinessDayStartTimestamp(date: Date): number {
		const { year, month, day } = this.getSaoPauloDateParts(date);
		return Date.UTC(year, month - 1, day);
	}

	private getBusinessDayKey(date: Date): string {
		const { year, month, day } = this.getSaoPauloDateParts(date);
		return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	private getAvailableChannels(
		patient: PatientEntity,
	): ECommunicationChannel[] {
		const channels: ECommunicationChannel[] = [];

		if (patient.phone) {
			channels.push(ECommunicationChannel.WhatsApp);
		}
		if (patient.email) {
			channels.push(ECommunicationChannel.Email);
		}

		return channels;
	}

	private patientCanReceiveChannel(
		patient: PatientEntity,
		channel: ECommunicationChannel,
	): boolean {
		if (channel === ECommunicationChannel.WhatsApp) {
			return patient.phone !== null;
		}
		if (channel === ECommunicationChannel.Email) {
			return patient.email !== null;
		}

		return false;
	}

	private getSaoPauloDateParts(date: Date): {
		year: number;
		month: number;
		day: number;
		hour: number;
	} {
		const formatter = new Intl.DateTimeFormat('en-CA', {
			timeZone: SAO_PAULO_TIME_ZONE,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			hourCycle: 'h23',
		});
		const parts = formatter.formatToParts(date);

		return {
			year: Number(parts.find((part) => part.type === 'year')?.value),
			month: Number(parts.find((part) => part.type === 'month')?.value),
			day: Number(parts.find((part) => part.type === 'day')?.value),
			hour: Number(parts.find((part) => part.type === 'hour')?.value),
		};
	}
}

export type { CollectionRulePolicyInput };
