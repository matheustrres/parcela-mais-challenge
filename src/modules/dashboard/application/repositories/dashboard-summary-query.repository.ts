import { EntityId } from '@/@core/domain/entities/entity-id';

export type DashboardSummary = {
	totalReceivableCents: number;
	totalOverdueCents: number;
	paidThisMonthCents: number;
	overduePatients: number;
	openInstallments: number;
	paidInstallments: number;
	communicationsGeneratedToday: number;
};

export abstract class DashboardSummaryQueryRepository {
	abstract getByClinicIdAndReferenceDate(
		clinicId: EntityId,
		referenceDate: Date,
	): Promise<DashboardSummary>;
}
