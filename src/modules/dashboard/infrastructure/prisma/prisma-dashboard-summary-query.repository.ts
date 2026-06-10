import { Injectable } from '@nestjs/common';

import { EntityId } from '@/@core/domain/entities/entity-id';
import { EInstallmentStatus } from '@/@core/enums/domain';

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
		const dayRange = this.getDayRange(referenceDate);
		const monthRange = this.getMonthRange(referenceDate);
		const openStatuses = [
			EInstallmentStatus.Pending,
			EInstallmentStatus.PartiallyPaid,
		];
		const [openInstallments, paidInstallments, paymentsAggregate, commsToday] =
			await Promise.all([
				this.databaseService.installment.findMany({
					where: {
						clinicId,
						status: {
							in: openStatuses,
						},
					},
					select: {
						dueDate: true,
						amountCents: true,
						paidAmountCents: true,
						debtAgreement: {
							select: {
								patientId: true,
							},
						},
					},
				}),
				this.databaseService.installment.count({
					where: {
						clinicId,
						status: EInstallmentStatus.Paid,
					},
				}),
				this.databaseService.payment.aggregate({
					where: {
						clinicId,
						paidAt: {
							gte: monthRange.start,
							lt: monthRange.end,
						},
					},
					_sum: {
						amountCents: true,
					},
				}),
				this.databaseService.communicationAttempt.count({
					where: {
						clinicId,
						createdAt: {
							gte: dayRange.start,
							lt: dayRange.end,
						},
					},
				}),
			]);

		const totalReceivableCents = openInstallments.reduce(
			(total, installment) =>
				total + (installment.amountCents - installment.paidAmountCents),
			0,
		);
		const overdueInstallments = openInstallments.filter(
			(installment) => installment.dueDate.getTime() < dayRange.start.getTime(),
		);
		const totalOverdueCents = overdueInstallments.reduce(
			(total, installment) =>
				total + (installment.amountCents - installment.paidAmountCents),
			0,
		);
		const overduePatients = new Set(
			overdueInstallments.map(
				(installment) => installment.debtAgreement.patientId,
			),
		).size;

		return {
			totalReceivableCents,
			totalOverdueCents,
			paidThisMonthCents: paymentsAggregate._sum.amountCents ?? 0,
			overduePatients,
			openInstallments: openInstallments.length,
			paidInstallments,
			communicationsGeneratedToday: commsToday,
		};
	}

	private getDayRange(referenceDate: Date): { start: Date; end: Date } {
		const start = new Date(referenceDate);
		start.setHours(0, 0, 0, 0);
		const end = new Date(start);
		end.setDate(end.getDate() + 1);
		return { start, end };
	}

	private getMonthRange(referenceDate: Date): { start: Date; end: Date } {
		const start = new Date(referenceDate);
		start.setDate(1);
		start.setHours(0, 0, 0, 0);
		const end = new Date(start);
		end.setMonth(end.getMonth() + 1);
		return { start, end };
	}
}
