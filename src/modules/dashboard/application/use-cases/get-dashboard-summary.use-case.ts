import { Injectable } from '@nestjs/common';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { UseCase } from '@/@core/application/use-case';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';

import { ClinicRepository } from '@/modules/clinics/application/repositories/clinic.repository';
import { ListDelinquentPatientsUseCase } from '@/modules/collections/application/use-cases/list-delinquent-patients.use-case';
import { DashboardSummaryQueryRepository } from '@/modules/dashboard/application/repositories/dashboard-summary-query.repository';

export type GetDashboardSummaryInput = {
	clinicId: string;
	referenceDate?: Date;
};

export type GetDashboardSummaryOutput = Awaited<
	ReturnType<DashboardSummaryQueryRepository['getByClinicIdAndReferenceDate']>
>;

@Injectable()
export class GetDashboardSummaryUseCase implements UseCase<
	GetDashboardSummaryInput,
	GetDashboardSummaryOutput
> {
	constructor(
		private readonly clinicRepository: ClinicRepository,
		private readonly listDelinquentPatientsUseCase: ListDelinquentPatientsUseCase,
		private readonly dashboardSummaryQueryRepository: DashboardSummaryQueryRepository,
	) {}

	async exec(
		input: GetDashboardSummaryInput,
	): Promise<GetDashboardSummaryOutput> {
		const clinicId = EntityUuid.createFrom(input.clinicId);
		const referenceDate = this.resolveReferenceDate(input.referenceDate);

		const clinic = await this.clinicRepository.findById(clinicId);
		if (!clinic) {
			throw new ApplicationException('CLINIC_NOT_FOUND');
		}

		const [summary, delinquentPatients] = await Promise.all([
			this.dashboardSummaryQueryRepository.getByClinicIdAndReferenceDate(
				clinicId,
				referenceDate,
			),
			this.listDelinquentPatientsUseCase.exec({
				clinicId: clinicId.toString(),
				referenceDate,
				limit: 5,
				offset: 0,
			}),
		]);

		return {
			...summary,
			priority: {
				topDelinquentPatients: delinquentPatients.items.map((item) => ({
					patientId: item.patientId,
					patientName: item.patientName,
					totalOverdueCents: item.totalOverdueCents,
					overdueInstallments: item.overdueInstallments,
					daysOverdue: item.daysOverdue,
					priorityScore: item.priorityScore,
					priorityReasons: item.priorityReasons,
					lastCommunicationAt: item.lastCommunicationAt,
					suggestedAction: item.suggestedAction,
					suggestedActionSkippedReason:
						item.suggestedActionSkippedReason,
				})),
			},
		};
	}

	private resolveReferenceDate(referenceDate?: Date): Date {
		if (referenceDate === undefined) {
			return new Date();
		}
		if (
			!(referenceDate instanceof Date) ||
			Number.isNaN(referenceDate.getTime())
		) {
			throw new ApplicationException('INVALID_DASHBOARD_REFERENCE_DATE');
		}
		return referenceDate;
	}
}
