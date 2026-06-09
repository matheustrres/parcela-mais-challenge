import { describe, expect, it } from 'vitest';

import {
	ECommunicationChannel,
	ECommunicationType,
	EContactStatus,
	EDebtAgreementStatus,
	EInstallmentStatus,
} from '@/@core/enums/domain';

import { ECollectionRuleSkippedReason } from '@/modules/collections/domain/enums/collection-rule-skipped-reason';
import { CollectionRulePolicyDomainService } from '@/modules/collections/domain/services/collection-rule-policy.service';

import { buildCommunicationAttemptEntity } from '#/data/builders/entities/communication-attempt.entity.builder';
import { buildDebtAgreementEntity } from '#/data/builders/entities/debt-agreement.entity.builder';
import { buildInstallmentEntity } from '#/data/builders/entities/installment.entity.builder';
import { buildPatientEntity } from '#/data/builders/entities/patient.entity.builder';
import { buildPaymentEntity } from '#/data/builders/entities/payment.entity.builder';

describe('CollectionRulePolicyDomainService', () => {
	const service = new CollectionRulePolicyDomainService();

	const makeInput = (overrides?: {
		installmentStatus?: EInstallmentStatus;
		installmentPaidAt?: Date | null;
		debtAgreementStatus?: EDebtAgreementStatus;
		patientContactStatus?: EContactStatus;
		patientEmail?: string | null;
		patientPhone?: string | null;
		patientPreferredChannel?: ECommunicationChannel | null;
		previousAttempts?: ReturnType<typeof buildCommunicationAttemptEntity>[];
		recentPayments?: ReturnType<typeof buildPaymentEntity>[];
		referenceDate?: Date;
	}) => {
		const patient = buildPatientEntity({
			id: 'patient-1',
			clinicId: 'clinic-1',
			email: overrides?.patientEmail ?? 'patient@example.com',
			phone: overrides?.patientPhone ?? '11999999999',
			preferredChannel:
				overrides?.patientPreferredChannel === undefined
					? ECommunicationChannel.WhatsApp
					: overrides.patientPreferredChannel,
			contactStatus: overrides?.patientContactStatus ?? EContactStatus.Active,
		});
		const installment = buildInstallmentEntity({
			id: 'installment-1',
			clinicId: 'clinic-1',
			debtAgreementId: 'debt-agreement-1',
			dueDate: new Date('2024-04-10T12:00:00.000Z'),
			status: overrides?.installmentStatus ?? EInstallmentStatus.Pending,
			paidAt: overrides?.installmentPaidAt ?? null,
		});
		const debtAgreement = buildDebtAgreementEntity({
			id: 'debt-agreement-1',
			clinicId: 'clinic-1',
			patientId: 'patient-1',
			status: overrides?.debtAgreementStatus ?? EDebtAgreementStatus.Active,
		});

		return {
			patient,
			installment,
			debtAgreement,
			previousAttempts: overrides?.previousAttempts ?? [],
			recentPayments: overrides?.recentPayments ?? [],
			referenceDate:
				overrides?.referenceDate ?? new Date('2024-04-17T13:00:00.000Z'),
		};
	};

	it('should generate pre due reminder on D-3', () => {
		const decision = service.decide(
			makeInput({
				referenceDate: new Date('2024-04-07T13:00:00.000Z'),
			}),
		);

		expect(decision.items).toEqual([
			{
				type: ECommunicationType.PreDueReminder,
				channel: ECommunicationChannel.WhatsApp,
				status: 'GENERATED',
				skippedReason: null,
			},
		]);
	});

	it('should generate D+7 whatsapp before email', () => {
		const decision = service.decide(makeInput());

		expect(decision.items).toEqual([
			{
				type: ECommunicationType.OverdueFollowUp,
				channel: ECommunicationChannel.WhatsApp,
				status: 'GENERATED',
				skippedReason: null,
			},
			{
				type: ECommunicationType.OverdueFollowUp,
				channel: ECommunicationChannel.Email,
				status: 'GENERATED',
				skippedReason: null,
			},
		]);
	});

	it('should skip only duplicated type plus channel on D+7', () => {
		const duplicatedAttempt = buildCommunicationAttemptEntity({
			patientId: 'patient-1',
			installmentId: 'installment-1',
			type: ECommunicationType.OverdueFollowUp,
			channel: ECommunicationChannel.WhatsApp,
			scheduledFor: new Date('2024-04-10T13:00:00.000Z'),
		});

		const decision = service.decide(
			makeInput({
				previousAttempts: [duplicatedAttempt],
			}),
		);

		expect(decision.items).toEqual([
			{
				type: ECommunicationType.OverdueFollowUp,
				channel: ECommunicationChannel.WhatsApp,
				status: 'SKIPPED',
				skippedReason:
					ECollectionRuleSkippedReason.CommunicationTypeAlreadyExists,
			},
			{
				type: ECommunicationType.OverdueFollowUp,
				channel: ECommunicationChannel.Email,
				status: 'GENERATED',
				skippedReason: null,
			},
		]);
	});

	it('should skip globally when installment is paid', () => {
		const decision = service.decide(
			makeInput({
				installmentStatus: EInstallmentStatus.Paid,
				installmentPaidAt: new Date('2024-04-17T12:00:00.000Z'),
			}),
		);

		expect(decision.items).toEqual([
			{
				type: null,
				channel: null,
				status: 'SKIPPED',
				skippedReason: ECollectionRuleSkippedReason.InstallmentAlreadyPaid,
			},
		]);
	});

	it('should skip globally when installment is canceled', () => {
		const decision = service.decide(
			makeInput({
				installmentStatus: EInstallmentStatus.Canceled,
			}),
		);

		expect(decision.items[0]?.skippedReason).toBe(
			ECollectionRuleSkippedReason.InstallmentCanceled,
		);
	});

	it('should skip globally when debt agreement is canceled', () => {
		const decision = service.decide(
			makeInput({
				debtAgreementStatus: EDebtAgreementStatus.Canceled,
			}),
		);

		expect(decision.items[0]?.skippedReason).toBe(
			ECollectionRuleSkippedReason.DebtAgreementCanceled,
		);
	});

	it('should skip globally when patient is do not contact', () => {
		const decision = service.decide(
			makeInput({
				patientContactStatus: EContactStatus.DoNotContact,
			}),
		);

		expect(decision.items[0]?.skippedReason).toBe(
			ECollectionRuleSkippedReason.PatientDoNotContact,
		);
	});

	it('should skip globally when patient has no valid contact info', () => {
		const decision = service.decide(
			makeInput({
				patientEmail: null,
				patientPhone: null,
				patientPreferredChannel: null,
				patientContactStatus: EContactStatus.MissingContactInfo,
			}),
		);

		expect(decision.items[0]?.skippedReason).toBe(
			ECollectionRuleSkippedReason.PatientMissingContactInfo,
		);
	});

	it('should skip globally outside business hours in Sao Paulo', () => {
		const decision = service.decide(
			makeInput({
				referenceDate: new Date('2024-04-17T21:30:00.000Z'),
			}),
		);

		expect(decision.items[0]?.skippedReason).toBe(
			ECollectionRuleSkippedReason.OutsideBusinessHours,
		);
	});

	it('should skip globally when patient already had communication today', () => {
		const attemptToday = buildCommunicationAttemptEntity({
			patientId: 'patient-1',
			installmentId: 'other-installment-1',
			type: ECommunicationType.DueDateReminder,
			channel: ECommunicationChannel.WhatsApp,
			scheduledFor: new Date('2024-04-17T12:00:00.000Z'),
		});

		const decision = service.decide(
			makeInput({
				previousAttempts: [attemptToday],
			}),
		);

		expect(decision.items[0]?.skippedReason).toBe(
			ECollectionRuleSkippedReason.PatientAlreadyContactedToday,
		);
	});

	it('should skip globally when there was recent partial payment', () => {
		const recentPayment = buildPaymentEntity({
			installmentId: 'installment-1',
			paidAt: new Date('2024-04-17T11:00:00.000Z'),
		});

		const decision = service.decide(
			makeInput({
				recentPayments: [recentPayment],
			}),
		);

		expect(decision.items[0]?.skippedReason).toBe(
			ECollectionRuleSkippedReason.RecentPartialPayment,
		);
	});

	it('should skip globally when there is no rule for current date', () => {
		const decision = service.decide(
			makeInput({
				referenceDate: new Date('2024-04-11T13:00:00.000Z'),
			}),
		);

		expect(decision.items[0]?.skippedReason).toBe(
			ECollectionRuleSkippedReason.NoRuleForCurrentDate,
		);
	});
});
