import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { EntityId } from '@/@core/domain/entities/entity-id';
import { EDebtAgreementStatus } from '@/@core/enums/domain';

import {
	DebtAgreementDetail,
	DebtAgreementListItem,
	DebtAgreementQueryRepository,
	PaginatedDebtAgreements,
} from '@/modules/debt-agreements/application/repositories/debt-agreement-query.repository';
import { DebtAgreementPrismaMapper } from '@/modules/debt-agreements/infrastructure/prisma/debt-agreement-prisma.mapper';
import { InstallmentPrismaMapper } from '@/modules/installments/infrastructure/prisma/installment-prisma.mapper';

import { DatabaseService } from '@/shared/modules/database/database.service';

type DebtAgreementRecord = Prisma.DebtAgreementGetPayload<{
	include: {
		patient: true;
		installments: true;
	};
}>;

@Injectable()
export class PrismaDebtAgreementQueryRepository implements DebtAgreementQueryRepository {
	constructor(private readonly databaseService: DatabaseService) {}

	async findByIdAndClinicId(
		debtAgreementId: EntityId,
		clinicId: EntityId,
	): Promise<DebtAgreementDetail | null> {
		const debtAgreement = await this.databaseService.debtAgreement.findFirst({
			where: {
				id: debtAgreementId.toString(),
				clinicId: clinicId.toString(),
			},
			include: {
				patient: true,
				installments: {
					orderBy: {
						installmentNumber: 'asc',
					},
				},
			},
		});

		if (!debtAgreement) {
			return null;
		}

		return this.toItem(debtAgreement);
	}

	async findByClinicId(input: {
		clinicId: EntityId;
		patientId?: EntityId;
		status?: EDebtAgreementStatus;
		limit: number;
		offset: number;
	}): Promise<PaginatedDebtAgreements> {
		const where: Prisma.DebtAgreementWhereInput = {
			clinicId: input.clinicId.toString(),
			...(input.patientId && { patientId: input.patientId.toString() }),
			...(input.status && { status: input.status }),
		};

		const [total, debtAgreements] = await Promise.all([
			this.databaseService.debtAgreement.count({ where }),
			this.databaseService.debtAgreement.findMany({
				where,
				include: {
					patient: true,
					installments: {
						orderBy: {
							installmentNumber: 'asc',
						},
					},
				},
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				take: input.limit,
				skip: input.offset,
			}),
		]);

		return {
			total,
			items: debtAgreements.map((debtAgreement) => this.toItem(debtAgreement)),
		};
	}

	private toItem(record: DebtAgreementRecord): DebtAgreementListItem {
		return {
			debtAgreement: DebtAgreementPrismaMapper.toDomain(record),
			patient: {
				id: record.patient.id,
				name: record.patient.name,
			},
			installments: record.installments.map((installment) =>
				InstallmentPrismaMapper.toDomain(installment),
			),
		};
	}
}
