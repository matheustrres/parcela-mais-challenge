import { describe, expect, it } from 'vitest';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import {
	ECommunicationChannel,
	ECommunicationStatus,
	ECommunicationType,
	EInstallmentStatus,
	EPaymentMethod,
} from '@/@core/enums/domain';

import { ECollectionPriorityScoreReason } from '@/modules/collections/domain/enums/collection-priority-score-reason';
import { CollectionPriorityScoreDomainService } from '@/modules/collections/domain/services/collection-priority-score.service';
import { CommunicationAttemptEntity } from '@/modules/communications/domain/entities/communication-attempt.entity';
import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { PaymentEntity } from '@/modules/payments/domain/entities/payment.entity';

describe('CollectionPriorityScoreDomainService', () => {
	const service = new CollectionPriorityScoreDomainService();

	const makeInstallment = (
		id: string,
		overrides: Partial<{
			dueDate: Date;
			amount: MoneyVo;
			paidAmount: MoneyVo;
			status: EInstallmentStatus;
			paidAt: Date | null;
		}> = {},
	) =>
		InstallmentEntity.createFrom(
			EntityUuid.createFrom(id),
			{
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
			},
			{
				createdAt: new Date('2024-04-01T10:00:00.000Z'),
			},
		);

	const makeAttempt = (
		installment: InstallmentEntity,
		overrides: Partial<{
			type: ECommunicationType;
			channel: ECommunicationChannel;
			status: ECommunicationStatus;
			sentAt: Date | null;
			scheduledFor: Date | null;
			createdAt: Date;
		}> = {},
	) =>
		CommunicationAttemptEntity.createFrom(
			EntityUuid.create(),
			{
				clinicId: installment.clinicId,
				patientId: EntityUuid.createFrom('patient-id'),
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
			},
			{
				createdAt: overrides.createdAt ?? new Date('2024-04-17T10:00:00.000Z'),
			},
		);

	const makePayment = (
		installment: InstallmentEntity,
		overrides: Partial<{
			amount: MoneyVo;
			paidAt: Date;
		}> = {},
	) =>
		PaymentEntity.create({
			clinicId: installment.clinicId,
			installmentId: installment.id,
			amount: MoneyVo.fromCents(2_000),
			method: EPaymentMethod.Pix,
			externalReference: null,
			idempotencyKey: `idem-${installment.id.toString()}`,
			idempotencyPayloadHash: `hash-${installment.id.toString()}`,
			paidAt: new Date('2024-04-19T10:00:00.000Z'),
			...overrides,
		});

	it('should return zero when there are no overdue installments', () => {
		const installment = makeInstallment('installment-a', {
			dueDate: new Date('2024-04-25T12:00:00.000Z'),
		});
		expect(
			service.calculate({
				installments: [installment],
				communicationAttempts: [],
				payments: [],
				referenceDate: new Date('2024-04-20T13:00:00.000Z'),
			}),
		).toEqual({
			score: 0,
			reasons: [],
		});
	});

	it('should calculate score from overdue buckets without penalties', () => {
		const installment = makeInstallment('installment-a', {
			dueDate: new Date('2024-04-18T12:00:00.000Z'),
			amount: MoneyVo.fromCents(95_000),
		});
		expect(
			service.calculate({
				installments: [installment],
				communicationAttempts: [],
				payments: [],
				referenceDate: new Date('2024-04-20T13:00:00.000Z'),
			}),
		).toEqual({
			score: 33,
			reasons: [
				ECollectionPriorityScoreReason.OverdueDays,
				ECollectionPriorityScoreReason.OverdueAmount,
				ECollectionPriorityScoreReason.OverdueInstallmentsCount,
			],
		});
	});

	it('should use highest overdue days and overdue installments count buckets', () => {
		const installmentA = makeInstallment('installment-a', {
			dueDate: new Date('2024-04-01T12:00:00.000Z'),
			amount: MoneyVo.fromCents(50_000),
		});
		const installmentB = makeInstallment('installment-b', {
			dueDate: new Date('2024-04-15T12:00:00.000Z'),
			amount: MoneyVo.fromCents(50_000),
		});
		const installmentC = makeInstallment('installment-c', {
			dueDate: new Date('2024-04-17T12:00:00.000Z'),
			amount: MoneyVo.fromCents(50_000),
		});
		expect(
			service.calculate({
				installments: [installmentA, installmentB, installmentC],
				communicationAttempts: [],
				payments: [],
				referenceDate: new Date('2024-05-10T13:00:00.000Z'),
			}),
		).toEqual({
			score: 80,
			reasons: [
				ECollectionPriorityScoreReason.OverdueDays,
				ECollectionPriorityScoreReason.OverdueAmount,
				ECollectionPriorityScoreReason.OverdueInstallmentsCount,
			],
		});
	});

	it('should keep score within upper bound', () => {
		const installments = [
			makeInstallment('installment-a', {
				dueDate: new Date('2024-01-01T12:00:00.000Z'),
				amount: MoneyVo.fromCents(200_000),
			}),
			makeInstallment('installment-b', {
				dueDate: new Date('2024-01-02T12:00:00.000Z'),
				amount: MoneyVo.fromCents(200_000),
			}),
			makeInstallment('installment-c', {
				dueDate: new Date('2024-01-03T12:00:00.000Z'),
				amount: MoneyVo.fromCents(200_000),
			}),
		];
		expect(
			service.calculate({
				installments,
				communicationAttempts: [],
				payments: [],
				referenceDate: new Date('2024-06-20T13:00:00.000Z'),
			}).score,
		).toBe(80);
	});

	it('should apply recent communication penalty only for relevant overdue installments', () => {
		const overdueInstallment = makeInstallment('installment-a', {
			dueDate: new Date('2024-04-18T12:00:00.000Z'),
		});
		const irrelevantInstallment = makeInstallment('installment-b', {
			dueDate: new Date('2024-05-10T12:00:00.000Z'),
		});
		const attempts = [
			makeAttempt(overdueInstallment, {
				sentAt: new Date('2024-04-20T09:00:00.000Z'),
			}),
			makeAttempt(irrelevantInstallment, {
				sentAt: new Date('2024-04-20T11:00:00.000Z'),
			}),
		];
		expect(
			service.calculate({
				installments: [overdueInstallment],
				communicationAttempts: attempts,
				payments: [],
				referenceDate: new Date('2024-04-20T13:00:00.000Z'),
			}),
		).toEqual({
			score: 8,
			reasons: [
				ECollectionPriorityScoreReason.OverdueDays,
				ECollectionPriorityScoreReason.OverdueAmount,
				ECollectionPriorityScoreReason.OverdueInstallmentsCount,
				ECollectionPriorityScoreReason.RecentCommunication,
			],
		});
	});

	it('should ignore future scheduledFor and fallback to createdAt when sentAt is absent', () => {
		const installment = makeInstallment('installment-a', {
			dueDate: new Date('2024-04-18T12:00:00.000Z'),
		});
		const attempt = makeAttempt(installment, {
			sentAt: null,
			scheduledFor: new Date('2024-04-22T10:00:00.000Z'),
			createdAt: new Date('2024-04-19T10:00:00.000Z'),
		});
		expect(
			service.calculate({
				installments: [installment],
				communicationAttempts: [attempt],
				payments: [],
				referenceDate: new Date('2024-04-20T13:00:00.000Z'),
			}),
		).toEqual({
			score: 13,
			reasons: [
				ECollectionPriorityScoreReason.OverdueDays,
				ECollectionPriorityScoreReason.OverdueAmount,
				ECollectionPriorityScoreReason.OverdueInstallmentsCount,
				ECollectionPriorityScoreReason.RecentCommunication,
			],
		});
	});

	it('should apply recent partial payment penalty only for overdue installments still open', () => {
		const overdueInstallment = makeInstallment('installment-a', {
			dueDate: new Date('2024-04-10T12:00:00.000Z'),
			amount: MoneyVo.fromCents(20_000),
			paidAmount: MoneyVo.fromCents(5_000),
			status: EInstallmentStatus.PartiallyPaid,
		});
		const paidInstallment = makeInstallment('installment-b', {
			dueDate: new Date('2024-04-10T12:00:00.000Z'),
			amount: MoneyVo.fromCents(20_000),
			paidAmount: MoneyVo.fromCents(20_000),
			status: EInstallmentStatus.Paid,
			paidAt: new Date('2024-04-19T12:00:00.000Z'),
		});
		const payments = [
			makePayment(overdueInstallment, {
				paidAt: new Date('2024-04-20T08:00:00.000Z'),
			}),
			makePayment(paidInstallment, {
				paidAt: new Date('2024-04-20T09:00:00.000Z'),
			}),
		];
		expect(
			service.calculate({
				installments: [overdueInstallment],
				communicationAttempts: [],
				payments,
				referenceDate: new Date('2024-04-20T13:00:00.000Z'),
			}),
		).toEqual({
			score: 24,
			reasons: [
				ECollectionPriorityScoreReason.OverdueDays,
				ECollectionPriorityScoreReason.OverdueAmount,
				ECollectionPriorityScoreReason.OverdueInstallmentsCount,
				ECollectionPriorityScoreReason.RecentPartialPayment,
			],
		});
	});

	it('should ignore canceled installments and irrelevant payments', () => {
		const overdueInstallment = makeInstallment('installment-a', {
			dueDate: new Date('2024-04-10T12:00:00.000Z'),
			amount: MoneyVo.fromCents(8_000),
		});
		const canceledInstallment = makeInstallment('installment-b', {
			dueDate: new Date('2024-04-01T12:00:00.000Z'),
			amount: MoneyVo.fromCents(100_000),
			status: EInstallmentStatus.Canceled,
		});
		const payments = [
			makePayment(canceledInstallment, {
				paidAt: new Date('2024-04-20T08:00:00.000Z'),
			}),
		];
		expect(
			service.calculate({
				installments: [overdueInstallment, canceledInstallment],
				communicationAttempts: [],
				payments,
				referenceDate: new Date('2024-04-20T13:00:00.000Z'),
			}),
		).toEqual({
			score: 34,
			reasons: [
				ECollectionPriorityScoreReason.OverdueDays,
				ECollectionPriorityScoreReason.OverdueAmount,
				ECollectionPriorityScoreReason.OverdueInstallmentsCount,
			],
		});
	});

	it('should clamp score to zero when penalties exceed positive components', () => {
		const installment = makeInstallment('installment-a', {
			dueDate: new Date('2024-04-19T12:00:00.000Z'),
			amount: MoneyVo.fromCents(1_000),
		});
		const attempt = makeAttempt(installment, {
			sentAt: new Date('2024-04-20T08:00:00.000Z'),
		});
		const payment = makePayment(installment, {
			paidAt: new Date('2024-04-20T09:00:00.000Z'),
		});
		expect(
			service.calculate({
				installments: [installment],
				communicationAttempts: [attempt],
				payments: [payment],
				referenceDate: new Date('2024-04-20T13:00:00.000Z'),
			}),
		).toEqual({
			score: 0,
			reasons: [
				ECollectionPriorityScoreReason.OverdueDays,
				ECollectionPriorityScoreReason.OverdueAmount,
				ECollectionPriorityScoreReason.OverdueInstallmentsCount,
				ECollectionPriorityScoreReason.RecentCommunication,
				ECollectionPriorityScoreReason.RecentPartialPayment,
			],
		});
	});
});
