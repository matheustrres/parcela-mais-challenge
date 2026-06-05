import { describe, expect, it } from 'vitest';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import {
	ECommunicationChannel,
	ECommunicationStatus,
	ECommunicationType,
	EContactStatus,
	EInstallmentStatus,
} from '@/@core/enums/domain';

import { ECollectionRuleSkippedReason } from '@/modules/collections/domain/enums/collection-rule-skipped-reason';
import { CollectionRulePolicyDomainService } from '@/modules/collections/domain/services/collection-rule-policy.service';
import { CommunicationAttemptEntity } from '@/modules/communications/domain/entities/communication-attempt.entity';
import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { PatientEntity } from '@/modules/patients/domain/entities/patient.entity';

describe('CollectionRulePolicyDomainService', () => {
	const service = new CollectionRulePolicyDomainService();

	const makePatient = (
		overrides: Partial<{
			email: string | null;
			phone: string | null;
			preferredChannel: ECommunicationChannel | null;
			contactStatus: EContactStatus;
		}> = {},
	) =>
		PatientEntity.create({
			name: 'Maria Silva',
			clinicId: EntityUuid.createFrom('clinic-id'),
			email: 'maria@example.com',
			phone: '11999999999',
			preferredChannel: ECommunicationChannel.WhatsApp,
			contactStatus: EContactStatus.Active,
			...overrides,
		});

	const makeInstallment = (
		overrides: Partial<{
			dueDate: Date;
			status: EInstallmentStatus;
			paidAmount: MoneyVo;
			paidAt: Date | null;
		}> = {},
	) =>
		InstallmentEntity.create({
			clinicId: EntityUuid.createFrom('clinic-id'),
			debtAgreementId: EntityUuid.createFrom('agreement-id'),
			installmentNumber: 1,
			dueDate: new Date('2024-04-10T12:00:00.000Z'),
			amount: MoneyVo.fromCents(10_000),
			paidAmount: MoneyVo.zero(),
			status: EInstallmentStatus.Pending,
			paidAt: null,
			version: 0,
			...overrides,
		});

	const makeAttempt = (
		patient: PatientEntity,
		installment: InstallmentEntity,
		overrides: Partial<{
			type: ECommunicationType;
			channel: ECommunicationChannel;
			scheduledFor: Date | null;
			sentAt: Date | null;
		}> = {},
	) =>
		CommunicationAttemptEntity.create({
			clinicId: patient.clinicId,
			patientId: patient.id,
			installmentId: installment.id,
			type: ECommunicationType.OverdueFollowUp,
			channel: ECommunicationChannel.WhatsApp,
			status: ECommunicationStatus.Generated,
			scheduledFor: new Date('2024-04-17T13:00:00.000Z'),
			sentAt: null,
			skippedReason: null,
			message: null,
			aiGenerated: false,
			templateKey: null,
			...overrides,
		});

	describe('.decide success paths', () => {
		it('should generate pre due reminder on D-3', () => {
			const patient = makePatient();
			const installment = makeInstallment();

			expect(
				service.decide({
					patient,
					installment,
					previousAttempts: [],
					referenceDate: new Date('2024-04-07T13:00:00.000Z'),
				}),
			).toEqual({
				shouldCommunicate: true,
				skippedReason: null,
				actions: [
					{
						type: ECommunicationType.PreDueReminder,
						channel: ECommunicationChannel.WhatsApp,
					},
				],
			});
		});

		it('should generate due date reminder on D0', () => {
			const patient = makePatient();
			const installment = makeInstallment();

			expect(
				service.decide({
					patient,
					installment,
					previousAttempts: [],
					referenceDate: new Date('2024-04-10T13:00:00.000Z'),
				}),
			).toEqual({
				shouldCommunicate: true,
				skippedReason: null,
				actions: [
					{
						type: ECommunicationType.DueDateReminder,
						channel: ECommunicationChannel.WhatsApp,
					},
				],
			});
		});

		it('should generate overdue soft notice on D+2', () => {
			const patient = makePatient();
			const installment = makeInstallment();

			expect(
				service.decide({
					patient,
					installment,
					previousAttempts: [],
					referenceDate: new Date('2024-04-12T13:00:00.000Z'),
				}),
			).toEqual({
				shouldCommunicate: true,
				skippedReason: null,
				actions: [
					{
						type: ECommunicationType.OverdueSoftNotice,
						channel: ECommunicationChannel.WhatsApp,
					},
				],
			});
		});

		it('should generate two actions on D+7 when patient has both channels', () => {
			const patient = makePatient();
			const installment = makeInstallment();

			expect(
				service.decide({
					patient,
					installment,
					previousAttempts: [],
					referenceDate: new Date('2024-04-17T13:00:00.000Z'),
				}),
			).toEqual({
				shouldCommunicate: true,
				skippedReason: null,
				actions: [
					{
						type: ECommunicationType.OverdueFollowUp,
						channel: ECommunicationChannel.WhatsApp,
					},
					{
						type: ECommunicationType.OverdueFollowUp,
						channel: ECommunicationChannel.Email,
					},
				],
			});
		});

		it('should generate one whatsapp action on D+7 when patient only has phone', () => {
			const patient = makePatient({
				email: null,
				preferredChannel: ECommunicationChannel.WhatsApp,
			});
			const installment = makeInstallment();

			expect(
				service.decide({
					patient,
					installment,
					previousAttempts: [],
					referenceDate: new Date('2024-04-17T13:00:00.000Z'),
				}),
			).toEqual({
				shouldCommunicate: true,
				skippedReason: null,
				actions: [
					{
						type: ECommunicationType.OverdueFollowUp,
						channel: ECommunicationChannel.WhatsApp,
					},
				],
			});
		});

		it('should generate one email action on D+7 when patient only has email', () => {
			const patient = makePatient({
				phone: null,
				preferredChannel: ECommunicationChannel.Email,
			});
			const installment = makeInstallment();

			expect(
				service.decide({
					patient,
					installment,
					previousAttempts: [],
					referenceDate: new Date('2024-04-17T13:00:00.000Z'),
				}),
			).toEqual({
				shouldCommunicate: true,
				skippedReason: null,
				actions: [
					{
						type: ECommunicationType.OverdueFollowUp,
						channel: ECommunicationChannel.Email,
					},
				],
			});
		});

		it('should generate overdue escalation on D+15', () => {
			const patient = makePatient();
			const installment = makeInstallment();

			expect(
				service.decide({
					patient,
					installment,
					previousAttempts: [],
					referenceDate: new Date('2024-04-25T13:00:00.000Z'),
				}),
			).toEqual({
				shouldCommunicate: true,
				skippedReason: null,
				actions: [
					{
						type: ECommunicationType.OverdueEscalation,
						channel: ECommunicationChannel.Email,
					},
				],
			});
		});
	});

	describe('.decide skip paths', () => {
		it('should skip when installment is paid', () => {
			const patient = makePatient();
			const installment = makeInstallment({
				status: EInstallmentStatus.Paid,
				paidAmount: MoneyVo.fromCents(10_000),
				paidAt: new Date('2024-04-09T10:00:00.000Z'),
			});

			expect(
				service.decide({
					patient,
					installment,
					previousAttempts: [],
					referenceDate: new Date('2024-04-17T13:00:00.000Z'),
				}).skippedReason,
			).toBe(ECollectionRuleSkippedReason.InstallmentAlreadyPaid);
		});

		it('should skip when patient is do not contact', () => {
			const patient = makePatient({
				contactStatus: EContactStatus.DoNotContact,
			});
			const installment = makeInstallment();

			expect(
				service.decide({
					patient,
					installment,
					previousAttempts: [],
					referenceDate: new Date('2024-04-17T13:00:00.000Z'),
				}).skippedReason,
			).toBe(ECollectionRuleSkippedReason.PatientDoNotContact);
		});

		it('should skip when patient is missing contact info', () => {
			const patient = makePatient({
				email: null,
				phone: null,
				preferredChannel: null,
				contactStatus: EContactStatus.MissingContactInfo,
			});
			const installment = makeInstallment();

			expect(
				service.decide({
					patient,
					installment,
					previousAttempts: [],
					referenceDate: new Date('2024-04-17T13:00:00.000Z'),
				}).skippedReason,
			).toBe(ECollectionRuleSkippedReason.PatientMissingContactInfo);
		});

		it('should skip when outside business hours', () => {
			const patient = makePatient();
			const installment = makeInstallment();

			expect(
				service.decide({
					patient,
					installment,
					previousAttempts: [],
					referenceDate: new Date('2024-04-17T21:00:00.000Z'),
				}).skippedReason,
			).toBe(ECollectionRuleSkippedReason.OutsideBusinessHours);
		});

		it('should skip when there is no rule for the current date', () => {
			const patient = makePatient();
			const installment = makeInstallment();

			expect(
				service.decide({
					patient,
					installment,
					previousAttempts: [],
					referenceDate: new Date('2024-04-11T13:00:00.000Z'),
				}).skippedReason,
			).toBe(ECollectionRuleSkippedReason.NoRuleForCurrentDate);
		});

		it('should skip when patient already has an attempt on the same business day', () => {
			const patient = makePatient();
			const installment = makeInstallment();
			const sameDayAttempt = makeAttempt(patient, installment, {
				type: ECommunicationType.DueDateReminder,
				channel: ECommunicationChannel.WhatsApp,
				scheduledFor: new Date('2024-04-17T12:00:00.000Z'),
			});

			expect(
				service.decide({
					patient,
					installment,
					previousAttempts: [sameDayAttempt],
					referenceDate: new Date('2024-04-17T13:00:00.000Z'),
				}).skippedReason,
			).toBe(ECollectionRuleSkippedReason.PatientAlreadyContactedToday);
		});

		it('should skip when all actions for the rule already exist', () => {
			const patient = makePatient();
			const installment = makeInstallment();
			const whatsappAttempt = makeAttempt(patient, installment, {
				type: ECommunicationType.OverdueFollowUp,
				channel: ECommunicationChannel.WhatsApp,
				scheduledFor: new Date('2024-04-16T15:00:00.000Z'),
			});
			const emailAttempt = makeAttempt(patient, installment, {
				type: ECommunicationType.OverdueFollowUp,
				channel: ECommunicationChannel.Email,
				scheduledFor: new Date('2024-04-16T16:00:00.000Z'),
			});

			expect(
				service.decide({
					patient,
					installment,
					previousAttempts: [whatsappAttempt, emailAttempt],
					referenceDate: new Date('2024-04-17T13:00:00.000Z'),
				}).skippedReason,
			).toBe(ECollectionRuleSkippedReason.CommunicationTypeAlreadyExists);
		});
	});

	describe('.decide partial deduplication', () => {
		it('should return only email when whatsapp already exists on D+7', () => {
			const patient = makePatient();
			const installment = makeInstallment();
			const whatsappAttempt = makeAttempt(patient, installment, {
				type: ECommunicationType.OverdueFollowUp,
				channel: ECommunicationChannel.WhatsApp,
				scheduledFor: new Date('2024-04-16T15:00:00.000Z'),
			});

			expect(
				service.decide({
					patient,
					installment,
					previousAttempts: [whatsappAttempt],
					referenceDate: new Date('2024-04-17T13:00:00.000Z'),
				}),
			).toEqual({
				shouldCommunicate: true,
				skippedReason: null,
				actions: [
					{
						type: ECommunicationType.OverdueFollowUp,
						channel: ECommunicationChannel.Email,
					},
				],
			});
		});

		it('should return only whatsapp when email already exists on D+7', () => {
			const patient = makePatient();
			const installment = makeInstallment();
			const emailAttempt = makeAttempt(patient, installment, {
				type: ECommunicationType.OverdueFollowUp,
				channel: ECommunicationChannel.Email,
				scheduledFor: new Date('2024-04-16T15:00:00.000Z'),
			});

			expect(
				service.decide({
					patient,
					installment,
					previousAttempts: [emailAttempt],
					referenceDate: new Date('2024-04-17T13:00:00.000Z'),
				}),
			).toEqual({
				shouldCommunicate: true,
				skippedReason: null,
				actions: [
					{
						type: ECommunicationType.OverdueFollowUp,
						channel: ECommunicationChannel.WhatsApp,
					},
				],
			});
		});
	});

	describe('.decide time behavior', () => {
		it('should treat 09:00 Sao Paulo as inside business hours', () => {
			const patient = makePatient();
			const installment = makeInstallment();
			const decision = service.decide({
				patient,
				installment,
				previousAttempts: [],
				referenceDate: new Date('2024-04-10T12:00:00.000Z'),
			});

			expect(decision.shouldCommunicate).toBe(true);
		});

		it('should treat 18:00 Sao Paulo as outside business hours', () => {
			const patient = makePatient();
			const installment = makeInstallment();
			const decision = service.decide({
				patient,
				installment,
				previousAttempts: [],
				referenceDate: new Date('2024-04-10T21:00:00.000Z'),
			});

			expect(decision.skippedReason).toBe(
				ECollectionRuleSkippedReason.OutsideBusinessHours,
			);
		});

		it('should compare rule days using Sao Paulo business date', () => {
			const patient = makePatient();
			const installment = makeInstallment({
				dueDate: new Date('2024-04-10T01:30:00.000Z'),
			});
			const decision = service.decide({
				patient,
				installment,
				previousAttempts: [],
				referenceDate: new Date('2024-04-09T12:00:00.000Z'),
			});

			expect(decision.actions).toEqual([
				{
					type: ECommunicationType.DueDateReminder,
					channel: ECommunicationChannel.WhatsApp,
				},
			]);
		});
	});
});
