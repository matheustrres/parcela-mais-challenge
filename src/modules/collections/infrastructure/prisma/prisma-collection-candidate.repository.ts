import { Injectable } from '@nestjs/common';

import { EntityId } from '@/@core/domain/entities/entity-id';
import { EDebtAgreementStatus, EInstallmentStatus } from '@/@core/enums/domain';

import {
	CollectionCandidate,
	CollectionCandidateRepository,
} from '@/modules/collections/application/repositories/collection-candidate.repository';
import { DebtAgreementPrismaMapper } from '@/modules/debt-agreements/infrastructure/prisma/debt-agreement-prisma.mapper';
import { InstallmentPrismaMapper } from '@/modules/installments/infrastructure/prisma/installment-prisma.mapper';
import { PatientPrismaMapper } from '@/modules/patients/infrastructure/prisma/patient-prisma.mapper';

import { DatabaseService } from '@/shared/modules/database/database.service';

@Injectable()
export class PrismaCollectionCandidateRepository implements CollectionCandidateRepository {
	constructor(private readonly databaseService: DatabaseService) {}

	async findByClinicIdForRuleEvaluation(
		clinicId: EntityId,
	): Promise<CollectionCandidate[]> {
		const installments = await this.databaseService.installment.findMany({
			where: {
				clinicId: clinicId.toString(),
				status: {
					in: [
						EInstallmentStatus.Pending,
						EInstallmentStatus.PartiallyPaid,
						EInstallmentStatus.Canceled,
					],
				},
				debtAgreement: {
					status: {
						in: [EDebtAgreementStatus.Active, EDebtAgreementStatus.Canceled],
					},
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
}
