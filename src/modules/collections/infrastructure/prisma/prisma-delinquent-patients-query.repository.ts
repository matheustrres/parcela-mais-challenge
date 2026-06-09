import { Injectable } from '@nestjs/common';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { EDebtAgreementStatus, EInstallmentStatus } from '@/@core/enums/domain';

import {
	DelinquentPatientCandidate,
	DelinquentPatientsQueryRepository,
} from '@/modules/collections/application/repositories/delinquent-patients-query.repository';
import { DebtAgreementPrismaMapper } from '@/modules/debt-agreements/infrastructure/prisma/debt-agreement-prisma.mapper';
import { InstallmentPrismaMapper } from '@/modules/installments/infrastructure/prisma/installment-prisma.mapper';
import { PatientPrismaMapper } from '@/modules/patients/infrastructure/prisma/patient-prisma.mapper';

import { DatabaseService } from '@/shared/modules/database/database.service';

@Injectable()
export class PrismaDelinquentPatientsQueryRepository implements DelinquentPatientsQueryRepository {
	constructor(private readonly databaseService: DatabaseService) {}

	async findByClinicId(
		clinicId: EntityUuid,
		referenceDate: Date,
	): Promise<DelinquentPatientCandidate[]> {
		const referenceDayStart = this.toStartOfDay(referenceDate);
		const installments = await this.databaseService.installment.findMany({
			where: {
				clinicId: clinicId.toString(),
				status: {
					in: [EInstallmentStatus.Pending, EInstallmentStatus.PartiallyPaid],
				},
				dueDate: {
					lt: referenceDayStart,
				},
				debtAgreement: {
					status: EDebtAgreementStatus.Active,
				},
			},
			include: {
				debtAgreement: {
					include: {
						patient: true,
					},
				},
			},
			orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
		});
		return installments
			.filter(
				(installment) => installment.paidAmountCents < installment.amountCents,
			)
			.map((installment) => {
				const patient = installment.debtAgreement.patient;
				const debtAgreement = installment.debtAgreement;
				return {
					installment: InstallmentPrismaMapper.toDomain(installment),
					patient: PatientPrismaMapper.toDomain(patient),
					debtAgreement: DebtAgreementPrismaMapper.toDomain(debtAgreement),
				};
			});
	}

	private toStartOfDay(date: Date): Date {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate());
	}
}
