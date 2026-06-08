import { Prisma } from '@prisma/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createAppFixture } from '../__helpers/app-fixture';
import { cleanDatabase } from '../__helpers/database-cleaner';

import { CreateDebtAgreementUseCase } from '@/modules/debt-agreements/application/use-cases/create-debt-agreement.use-case';
import { InstallmentRepository } from '@/modules/installments/application/repositories/installment.repository';

import { DatabaseService } from '@/shared/modules/database/database.service';

describe('CreateDebtAgreementUseCase (e2e)', () => {
	let db: DatabaseService;
	let useCase: CreateDebtAgreementUseCase;
	let installmentRepository: InstallmentRepository;

	beforeAll(async () => {
		const fixture = await createAppFixture({
			shouldClearAllDb: true,
		});

		db = fixture.db;
		useCase = fixture.app.get(CreateDebtAgreementUseCase);
		installmentRepository = fixture.app.get(InstallmentRepository);
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		await cleanDatabase(db);
	});

	it('should persist debt agreement and installments in a single transaction', async () => {
		const clinic = await db.clinic.create({
			data: {
				name: 'Clinic Test',
			},
		});
		const patient = await db.patient.create({
			data: {
				clinicId: clinic.id,
				name: 'Patient Test',
				email: 'patient@example.com',
				phone: '11999999999',
				preferredChannel: null,
				contactStatus: 'ACTIVE',
			},
		});

		const output = await useCase.exec({
			clinicId: clinic.id,
			patientId: patient.id,
			totalAmountCents: 1_000,
			installmentsCount: 3,
			firstDueDate: new Date(2026, 0, 31, 9, 30, 0, 0),
		});

		const storedAgreement = await db.debtAgreement.findUniqueOrThrow({
			where: { id: output.debtAgreementId },
		});
		const storedInstallments = await db.installment.findMany({
			where: { debtAgreementId: output.debtAgreementId },
			orderBy: { installmentNumber: 'asc' },
		});

		expect(storedAgreement.totalAmountCents).toBe(1_000);
		expect(storedInstallments).toHaveLength(3);
		expect(
			storedInstallments.map((installment) => installment.amountCents),
		).toEqual([334, 333, 333]);
	});

	it('should rollback debt agreement when installment persistence fails inside transaction', async () => {
		const clinic = await db.clinic.create({
			data: {
				name: 'Clinic Test',
			},
		});
		const patient = await db.patient.create({
			data: {
				clinicId: clinic.id,
				name: 'Patient Test',
				email: 'patient@example.com',
				phone: '11999999999',
				preferredChannel: null,
				contactStatus: 'ACTIVE',
			},
		});

		const createManySpy = vi
			.spyOn(installmentRepository, 'createMany')
			.mockImplementationOnce(async (installments, tx) => {
				const client = (tx as { client: Prisma.TransactionClient }).client;
				await client.installment.createMany({
					data: installments.slice(0, 1).map((installment) => ({
						id: installment.id.toString(),
						clinicId: installment.clinicId.toString(),
						debtAgreementId: installment.debtAgreementId.toString(),
						installmentNumber: installment.installmentNumber,
						dueDate: installment.dueDate,
						amountCents: installment.amount.getCents(),
						paidAmountCents: installment.paidAmount.getCents(),
						status: installment.status,
						paidAt: installment.paidAt,
						version: installment.version,
						createdAt: installment.createdAt,
						updatedAt: installment.updatedAt ?? installment.createdAt,
					})),
				});

				throw new Error('forced installment failure');
			});

		await expect(
			useCase.exec({
				clinicId: clinic.id,
				patientId: patient.id,
				totalAmountCents: 1_000,
				installmentsCount: 3,
				firstDueDate: new Date(2026, 0, 31, 9, 30, 0, 0),
			}),
		).rejects.toThrowError('forced installment failure');

		expect(createManySpy).toHaveBeenCalledOnce();
		expect(await db.debtAgreement.count()).toBe(0);
		expect(await db.installment.count()).toBe(0);
	});
});
