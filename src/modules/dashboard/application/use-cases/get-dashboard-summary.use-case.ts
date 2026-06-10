import { Injectable } from '@nestjs/common';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { UseCase } from '@/@core/application/use-case';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';

import { ClinicRepository } from '@/modules/clinics/application/repositories/clinic.repository';
import { DashboardSummaryQueryRepository } from '@/modules/dashboard/application/repositories/dashboard-summary-query.repository';

export type GetDashboardSummaryInput = {
	clinicId: string;
	referenceDate: Date;
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
		private readonly dashboardSummaryQueryRepository: DashboardSummaryQueryRepository,
	) {}

	async exec(
		input: GetDashboardSummaryInput,
	): Promise<GetDashboardSummaryOutput> {
		const clinicId = EntityUuid.createFrom(input.clinicId);
		const referenceDate = this.ensureValidReferenceDate(input.referenceDate);

		const clinic = await this.clinicRepository.findById(clinicId);
		if (!clinic) {
			throw new ApplicationException('CLINIC_NOT_FOUND');
		}

		return this.dashboardSummaryQueryRepository.getByClinicIdAndReferenceDate(
			clinicId,
			referenceDate,
		);
	}

	private ensureValidReferenceDate(referenceDate: Date): Date {
		if (
			!(referenceDate instanceof Date) ||
			Number.isNaN(referenceDate.getTime())
		) {
			throw new ApplicationException('INVALID_DASHBOARD_REFERENCE_DATE');
		}
		return referenceDate;
	}
}
