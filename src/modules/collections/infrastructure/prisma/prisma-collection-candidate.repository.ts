import { Injectable } from '@nestjs/common';

import { EntityId } from '@/@core/domain/entities/entity-id';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import {
	ECommunicationChannel,
	EContactStatus,
	EDebtAgreementStatus,
	EInstallmentStatus,
} from '@/@core/enums/domain';

import {
	CollectionCandidate,
	CollectionCandidateRepository,
} from '@/modules/collections/application/repositories/collection-candidate.repository';
import { DebtAgreementEntity } from '@/modules/debt-agreements/domain/entities/debt-agreement.entity';
import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { PatientEntity } from '@/modules/patients/domain/entities/patient.entity';

import { DatabaseService } from '@/shared/modules/database/database.service';

@Injectable()
export class PrismaCollectionCandidateRepository extends CollectionCandidateRepository {
	constructor(private readonly databaseService: DatabaseService) {
		super();
	}

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
					installment: InstallmentEntity.createFrom(
						EntityUuid.createFrom(installment.id),
						{
							clinicId: EntityUuid.createFrom(installment.clinicId),
							debtAgreementId: EntityUuid.createFrom(
								installment.debtAgreementId,
							),
							installmentNumber: installment.installmentNumber,
							dueDate: installment.dueDate,
							amount: MoneyVo.fromCents(installment.amountCents),
							paidAmount: MoneyVo.fromCents(installment.paidAmountCents),
							status: installment.status as EInstallmentStatus,
							paidAt: installment.paidAt,
							version: installment.version,
						},
						{
							createdAt: installment.createdAt,
							updatedAt: installment.updatedAt,
						},
					),
					patient: PatientEntity.createFrom(
						EntityUuid.createFrom(patient.id),
						{
							name: patient.name,
							clinicId: EntityUuid.createFrom(patient.clinicId),
							email: patient.email,
							phone: patient.phone,
							preferredChannel:
								(patient.preferredChannel as ECommunicationChannel | null) ??
								null,
							contactStatus: patient.contactStatus as EContactStatus,
						},
						{
							createdAt: patient.createdAt,
							updatedAt: patient.updatedAt,
						},
					),
					debtAgreement: DebtAgreementEntity.createFrom(
						EntityUuid.createFrom(debtAgreement.id),
						{
							clinicId: EntityUuid.createFrom(debtAgreement.clinicId),
							patientId: EntityUuid.createFrom(debtAgreement.patientId),
							totalAmount: MoneyVo.fromCents(debtAgreement.totalAmountCents),
							installmentsCount: debtAgreement.installmentsCount,
							status: debtAgreement.status as EDebtAgreementStatus,
						},
						{
							createdAt: debtAgreement.createdAt,
							updatedAt: debtAgreement.updatedAt,
						},
					),
				};
			});
	}
}
