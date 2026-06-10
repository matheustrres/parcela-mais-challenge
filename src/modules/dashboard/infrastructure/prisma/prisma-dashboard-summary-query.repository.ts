import { Injectable } from '@nestjs/common';

import { EntityId } from '@/@core/domain/entities/entity-id';
import {
	ECommunicationChannel,
	ECommunicationType,
	EContactStatus,
	EDebtAgreementStatus,
	EInstallmentStatus,
} from '@/@core/enums/domain';

import {
	DashboardSummary,
	DashboardSummaryQueryRepository,
} from '@/modules/dashboard/application/repositories/dashboard-summary-query.repository';

import { DatabaseService } from '@/shared/modules/database/database.service';

@Injectable()
export class PrismaDashboardSummaryQueryRepository implements DashboardSummaryQueryRepository {
	constructor(private readonly databaseService: DatabaseService) {}

	async getByClinicIdAndReferenceDate(
		id: EntityId,
		referenceDate: Date,
	): Promise<DashboardSummary> {
		const clinicId = id.toString();
		const [agreements, patients, attempts, payments] = await Promise.all([
			this.databaseService.debtAgreement.findMany({
				where: { clinicId },
				select: {
					id: true,
					patientId: true,
					status: true,
					totalAmountCents: true,
					installments: {
						select: {
							id: true,
							status: true,
							dueDate: true,
							amountCents: true,
							paidAmountCents: true,
						},
					},
				},
			}),
			this.databaseService.patient.findMany({
				where: { clinicId },
				select: {
					id: true,
					contactStatus: true,
				},
			}),
			this.databaseService.communicationAttempt.findMany({
				where: { clinicId },
				select: {
					type: true,
					channel: true,
					createdAt: true,
					scheduledFor: true,
				},
			}),
			this.databaseService.payment.findMany({
				where: {
					clinicId,
					paidAt: {
						lte: referenceDate,
					},
				},
				select: {
					amountCents: true,
					paidAt: true,
				},
			}),
		]);

		const referenceDay = this.getBusinessDayStartTimestamp(referenceDate);
		const activeAgreements = agreements.filter(
			(agreement) => agreement.status === EDebtAgreementStatus.Active,
		);
		const nonCanceledAgreements = agreements.filter(
			(agreement) => agreement.status !== EDebtAgreementStatus.Canceled,
		);
		const activeInstallments = activeAgreements.flatMap((agreement) =>
			agreement.installments.map((installment) => ({
				...installment,
				patientId: agreement.patientId,
			})),
		);
		const nonCanceledInstallments = nonCanceledAgreements.flatMap((agreement) =>
			agreement.installments.map((installment) => ({
				...installment,
				patientId: agreement.patientId,
			})),
		);
		const overdueInstallments = activeInstallments.filter(
			(installment) =>
				this.isOpenInstallmentStatus(installment.status) &&
				this.getInstallmentDueDateTimestamp(installment.dueDate) <
					referenceDay &&
				installment.amountCents > installment.paidAmountCents,
		);
		const dueTodayInstallments = activeInstallments.filter(
			(installment) =>
				this.isOpenInstallmentStatus(installment.status) &&
				this.getInstallmentDueDateTimestamp(installment.dueDate) ===
					referenceDay &&
				installment.amountCents > installment.paidAmountCents,
		);
		const dueSoonInstallments = activeInstallments.filter((installment) => {
			if (
				!this.isOpenInstallmentStatus(installment.status) ||
				installment.amountCents <= installment.paidAmountCents
			) {
				return false;
			}

			const dueDay = this.getInstallmentDueDateTimestamp(installment.dueDate);
			return dueDay > referenceDay && dueDay <= this.addDays(referenceDay, 7);
		});
		const withOpenDebtPatients = new Set(
			activeInstallments
				.filter(
					(installment) =>
						this.isOpenInstallmentStatus(installment.status) &&
						installment.amountCents > installment.paidAmountCents,
				)
				.map((installment) => installment.patientId),
		);
		const delinquentPatients = new Set(
			overdueInstallments.map((installment) => installment.patientId),
		);
		const effectiveAttempts = attempts.filter((attempt) => {
			const effectiveAt = attempt.scheduledFor ?? attempt.createdAt;
			return effectiveAt.getTime() <= referenceDate.getTime();
		});
		const sevenDaysAgo = new Date(referenceDate);
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
		const thirtyDaysAgo = new Date(referenceDate);
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		return {
			clinicId,
			referenceDate,
			receivables: {
				totalDebtAmountCents: activeAgreements.reduce(
					(total, agreement) => total + agreement.totalAmountCents,
					0,
				),
				totalPaidAmountCents: activeInstallments.reduce(
					(total, installment) => total + installment.paidAmountCents,
					0,
				),
				totalOpenAmountCents: activeInstallments.reduce(
					(total, installment) =>
						total +
						Math.max(0, installment.amountCents - installment.paidAmountCents),
					0,
				),
				totalOverdueAmountCents: overdueInstallments.reduce(
					(total, installment) =>
						total + (installment.amountCents - installment.paidAmountCents),
					0,
				),
			},
			agreements: {
				total: agreements.length,
				active: agreements.filter(
					(agreement) => agreement.status === EDebtAgreementStatus.Active,
				).length,
				canceled: agreements.filter(
					(agreement) => agreement.status === EDebtAgreementStatus.Canceled,
				).length,
				fullyPaid: agreements.filter(
					(agreement) => agreement.status === EDebtAgreementStatus.Paid,
				).length,
			},
			installments: {
				total: nonCanceledInstallments.length,
				open: nonCanceledInstallments.filter((installment) =>
					this.isOpenInstallmentStatus(installment.status),
				).length,
				paid: nonCanceledInstallments.filter(
					(installment) => installment.status === EInstallmentStatus.Paid,
				).length,
				partiallyPaid: nonCanceledInstallments.filter(
					(installment) =>
						installment.status === EInstallmentStatus.PartiallyPaid,
				).length,
				overdue: overdueInstallments.length,
				dueToday: dueTodayInstallments.length,
				dueSoon: dueSoonInstallments.length,
			},
			patients: {
				total: patients.length,
				withOpenDebt: withOpenDebtPatients.size,
				delinquent: delinquentPatients.size,
				doNotContact: patients.filter(
					(patient) => patient.contactStatus === EContactStatus.DoNotContact,
				).length,
				missingContactInfo: patients.filter(
					(patient) =>
						patient.contactStatus === EContactStatus.MissingContactInfo,
				).length,
			},
			collections: {
				totalAttempts: effectiveAttempts.length,
				generatedToday: effectiveAttempts.filter((attempt) =>
					this.isSameBusinessDay(
						attempt.scheduledFor ?? attempt.createdAt,
						referenceDate,
					),
				).length,
				byChannel: {
					whatsapp: effectiveAttempts.filter(
						(attempt) => attempt.channel === ECommunicationChannel.WhatsApp,
					).length,
					email: effectiveAttempts.filter(
						(attempt) => attempt.channel === ECommunicationChannel.Email,
					).length,
				},
				byType: {
					preDueReminder: effectiveAttempts.filter(
						(attempt) => attempt.type === ECommunicationType.PreDueReminder,
					).length,
					dueDateReminder: effectiveAttempts.filter(
						(attempt) => attempt.type === ECommunicationType.DueDateReminder,
					).length,
					overdueSoftNotice: effectiveAttempts.filter(
						(attempt) => attempt.type === ECommunicationType.OverdueSoftNotice,
					).length,
					overdueFollowUp: effectiveAttempts.filter(
						(attempt) => attempt.type === ECommunicationType.OverdueFollowUp,
					).length,
					overdueEscalation: effectiveAttempts.filter(
						(attempt) => attempt.type === ECommunicationType.OverdueEscalation,
					).length,
				},
			},
			payments: {
				totalPayments: payments.length,
				paidAmountLast7DaysCents: payments
					.filter(
						(payment) =>
							payment.paidAt.getTime() > sevenDaysAgo.getTime() &&
							payment.paidAt.getTime() <= referenceDate.getTime(),
					)
					.reduce((total, payment) => total + payment.amountCents, 0),
				paidAmountLast30DaysCents: payments
					.filter(
						(payment) =>
							payment.paidAt.getTime() > thirtyDaysAgo.getTime() &&
							payment.paidAt.getTime() <= referenceDate.getTime(),
					)
					.reduce((total, payment) => total + payment.amountCents, 0),
			},
			priority: {
				topDelinquentPatients: [],
			},
		};
	}

	private addDays(timestamp: number, days: number): number {
		return timestamp + days * 24 * 60 * 60 * 1000;
	}

	private isOpenInstallmentStatus(status: string): boolean {
		return (
			status === EInstallmentStatus.Pending ||
			status === EInstallmentStatus.PartiallyPaid
		);
	}

	private isSameBusinessDay(left: Date, right: Date): boolean {
		return (
			this.getBusinessDayStartTimestamp(left) ===
			this.getBusinessDayStartTimestamp(right)
		);
	}

	private getInstallmentDueDateTimestamp(date: Date): number {
		return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
	}

	private getBusinessDayStartTimestamp(date: Date): number {
		const { year, month, day } = this.getSaoPauloDateParts(date);
		return Date.UTC(year, month - 1, day);
	}

	private getSaoPauloDateParts(date: Date): {
		year: number;
		month: number;
		day: number;
	} {
		const formatter = new Intl.DateTimeFormat('en-CA', {
			timeZone: 'America/Sao_Paulo',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		});
		const parts = formatter.formatToParts(date);

		return {
			year: Number(parts.find((part) => part.type === 'year')?.value),
			month: Number(parts.find((part) => part.type === 'month')?.value),
			day: Number(parts.find((part) => part.type === 'day')?.value),
		};
	}
}
