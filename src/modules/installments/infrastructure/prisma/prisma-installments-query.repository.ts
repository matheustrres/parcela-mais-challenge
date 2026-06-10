import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { EntityId } from '@/@core/domain/entities/entity-id';

import {
	InstallmentListItem,
	InstallmentsQueryRepository,
	PaginatedInstallments,
} from '@/modules/installments/application/repositories/installments-query.repository';
import { InstallmentPrismaMapper } from '@/modules/installments/infrastructure/prisma/installment-prisma.mapper';

import { DatabaseService } from '@/shared/modules/database/database.service';

type InstallmentListRecord = Prisma.InstallmentGetPayload<{
	include: {
		debtAgreement: {
			include: {
				patient: true;
			};
		};
	};
}>;

@Injectable()
export class PrismaInstallmentsQueryRepository implements InstallmentsQueryRepository {
	constructor(private readonly databaseService: DatabaseService) {}

	async findByClinicId(input: {
		clinicId: EntityId;
		limit: number;
		offset: number;
	}): Promise<PaginatedInstallments> {
		const [total, installments] = await Promise.all([
			this.databaseService.installment.count({
				where: {
					clinicId: input.clinicId.toString(),
				},
			}),
			this.databaseService.installment.findMany({
				where: {
					clinicId: input.clinicId.toString(),
				},
				include: {
					debtAgreement: {
						include: {
							patient: true,
						},
					},
				},
				orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
				take: input.limit,
				skip: input.offset,
			}),
		]);

		return {
			total,
			items: installments.map((record) => this.toItem(record)),
		};
	}

	private toItem(record: InstallmentListRecord): InstallmentListItem {
		return {
			installment: InstallmentPrismaMapper.toDomain(record),
			patient: {
				id: record.debtAgreement.patient.id,
				name: record.debtAgreement.patient.name,
				contactStatus: record.debtAgreement.patient
					.contactStatus as InstallmentListItem['patient']['contactStatus'],
			},
			debtAgreement: {
				id: record.debtAgreement.id,
				status: record.debtAgreement
					.status as InstallmentListItem['debtAgreement']['status'],
				installmentsCount: record.debtAgreement.installmentsCount,
				totalAmountCents: record.debtAgreement.totalAmountCents,
			},
		};
	}
}
