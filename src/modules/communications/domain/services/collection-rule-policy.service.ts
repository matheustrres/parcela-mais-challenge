import {
	ECommunicationChannel,
	ECommunicationType,
	EContactStatus,
} from '@/@core/enums/domain';

import { CommunicationAttemptEntity } from '@/modules/communications/domain/entities/communication-attempt.entity';
import { ECollectionRuleSkippedReason } from '@/modules/communications/domain/enums/collection-rule-skipped-reason';
import {
	CollectionRuleAction,
	CollectionRuleDecision,
} from '@/modules/communications/domain/types/collection-rule-decision';
import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { PatientEntity } from '@/modules/patients/domain/entities/patient.entity';

import { ensureValidDate } from '@/shared/utils/ensure-valid-date';

type CollectionRulePolicyInput = {
	patient: PatientEntity;
	installment: InstallmentEntity;
	previousAttempts: CommunicationAttemptEntity[];
	referenceDate: Date;
};

type CollectionRuleDecisionGuards = {
	isInstallmentPaid: boolean;
	isPatientDoNotContact: boolean;
	isPatientMissingContactInfo: boolean;
	availableChannels: ECommunicationChannel[];
	isWithinBusinessHours: boolean;
	ruleType: ECommunicationType | null;
	hasPatientAttemptToday: boolean;
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
			return this.skip(guardChecks.firstSkippedReason);
		}

		const ruleType = guardChecks.ruleType as ECommunicationType;
		const channelEligibleActions = this.filterAvailableChannels(
			input.patient,
			this.resolveActionsForType(ruleType),
		);
		if (!channelEligibleActions.length) {
			return this.skip(ECollectionRuleSkippedReason.PatientMissingContactInfo);
		}

		const actions = this.filterExistingAttempts(
			input.previousAttempts,
			input.installment,
			channelEligibleActions,
		);
		if (!actions.length) {
			return this.skip(
				ECollectionRuleSkippedReason.CommunicationTypeAlreadyExists,
			);
		}

		return {
			shouldCommunicate: true,
			actions,
			skippedReason: null,
		};
	}

	private buildDecisionGuards(
		input: CollectionRulePolicyInput,
	): CollectionRuleDecisionGuards {
		const guards = {
			isInstallmentPaid: input.installment.isPaid(),
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
		};

		const skipRules = [
			{
				when: guards.isInstallmentPaid,
				reason: ECollectionRuleSkippedReason.InstallmentAlreadyPaid,
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
		] as const;

		const firstSkippedReason =
			skipRules.find((rule) => rule.when)?.reason ?? null;

		return {
			...guards,
			firstSkippedReason,
		};
	}

	private skip(
		skippedReason: ECollectionRuleSkippedReason,
	): CollectionRuleDecision {
		return {
			shouldCommunicate: false,
			actions: [],
			skippedReason,
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
	): CollectionRuleAction[] {
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
		actions: CollectionRuleAction[],
	): CollectionRuleAction[] {
		return actions.filter((action) =>
			this.patientCanReceiveChannel(patient, action.channel),
		);
	}

	private filterExistingAttempts(
		previousAttempts: CommunicationAttemptEntity[],
		installment: InstallmentEntity,
		actions: CollectionRuleAction[],
	): CollectionRuleAction[] {
		return actions.filter(
			(action) =>
				!previousAttempts.some(
					(attempt) =>
						attempt.installmentId.equals(installment.id) &&
						attempt.type === action.type &&
						attempt.channel === action.channel,
				),
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
