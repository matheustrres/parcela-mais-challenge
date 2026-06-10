import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createAppFixture } from '../__helpers/app-fixture';
import { cleanDatabase } from '../__helpers/database-cleaner';

import {
	ECommunicationChannel,
	EContactStatus,
	EDebtAgreementStatus,
	EInstallmentStatus,
} from '@/@core/enums/domain';

import { DatabaseService } from '@/shared/modules/database/database.service';

describe('DebtAgreements read API (e2e)', () => {
	let db: DatabaseService;
	let httpServer: Parameters<typeof request>[0];

	beforeAll(async () => {
		const fixture = await createAppFixture({
			shouldClearAllDb: true,
		});

		db = fixture.db;
		httpServer = fixture.app.getHttpServer();
	});

	afterEach(async () => {
		await cleanDatabase(db);
	});

	async function createClinic(name: string) {
		return db.clinic.create({ data: { name } });
	}

	async function createPatient(clinicId: string, name: string, suffix: string) {
		return db.patient.create({
			data: {
				clinicId,
				name,
				email: `${suffix}@example.com`,
				phone: `11999999${suffix.slice(-3).padStart(3, '0')}`,
				preferredChannel: ECommunicationChannel.WhatsApp,
				contactStatus: EContactStatus.Active,
			},
		});
	}

	async function createDebtAgreement(input: {
		clinicId: string;
		patientId: string;
		totalAmountCents: number;
		installmentsCount: number;
		firstDueDate: string;
	}) {
		const response = await request(httpServer)
			.post('/debt-agreements')
			.send(input);
		expect(response.status).toBe(201);
		return response.body as {
			debtAgreementId: string;
			installments: { id: string; amountCents: number }[];
		};
	}

	it('should list debt agreements with filters, pagination and resolved referenceDate', async () => {
		const clinic = await createClinic('Clinic Read List');
		const patientA = await createPatient(clinic.id, 'Ana', '100');
		const patientB = await createPatient(clinic.id, 'Bruno', '200');

		const agreementA = await createDebtAgreement({
			clinicId: clinic.id,
			patientId: patientA.id,
			totalAmountCents: 1_000,
			installmentsCount: 3,
			firstDueDate: '2026-06-01T12:00:00.000Z',
		});
		const agreementB = await createDebtAgreement({
			clinicId: clinic.id,
			patientId: patientB.id,
			totalAmountCents: 500,
			installmentsCount: 1,
			firstDueDate: '2026-07-01T12:00:00.000Z',
		});

		await db.installment.update({
			where: { id: agreementA.installments[0]!.id },
			data: {
				dueDate: new Date('2026-06-01T12:00:00.000Z'),
				status: EInstallmentStatus.PartiallyPaid,
				paidAmountCents: 100,
			},
		});
		await db.installment.update({
			where: { id: agreementA.installments[1]!.id },
			data: {
				dueDate: new Date('2026-06-10T12:00:00.000Z'),
			},
		});
		await db.installment.update({
			where: { id: agreementA.installments[2]!.id },
			data: {
				dueDate: new Date('2026-07-10T12:00:00.000Z'),
				status: EInstallmentStatus.Paid,
				paidAmountCents: agreementA.installments[2]!.amountCents,
				paidAt: new Date('2026-06-05T12:00:00.000Z'),
			},
		});
		await db.debtAgreement.update({
			where: { id: agreementB.debtAgreementId },
			data: { status: EDebtAgreementStatus.Paid },
		});
		await db.installment.updateMany({
			where: { debtAgreementId: agreementB.debtAgreementId },
			data: {
				status: EInstallmentStatus.Paid,
				paidAmountCents: 500,
				paidAt: new Date('2026-07-02T12:00:00.000Z'),
			},
		});

		const listResponse = await request(httpServer)
			.get('/debt-agreements')
			.query({
				clinicId: clinic.id,
				referenceDate: '2026-06-10T15:00:00.000Z',
				limit: '10',
				offset: '0',
			});

		expect(listResponse.status).toBe(200);
		expect(listResponse.body.total).toBe(2);
		expect(listResponse.body.referenceDate).toBe('2026-06-10T15:00:00.000Z');
		expect(listResponse.body.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: agreementA.debtAgreementId,
					patientId: patientA.id,
					patientName: 'Ana',
					totalAmountCents: 1_000,
					paidAmountCents: 433,
					remainingAmountCents: 567,
					installmentsCount: 3,
					paidInstallments: 1,
					openInstallments: 2,
					overdueInstallments: 1,
					status: 'ACTIVE',
				}),
				expect.objectContaining({
					id: agreementB.debtAgreementId,
					patientId: patientB.id,
					patientName: 'Bruno',
					status: 'PAID',
				}),
			]),
		);

		const paginatedResponse = await request(httpServer)
			.get('/debt-agreements')
			.query({
				clinicId: clinic.id,
				limit: '1',
				offset: '1',
				referenceDate: '2026-06-10T15:00:00.000Z',
			});
		expect(paginatedResponse.status).toBe(200);
		expect(paginatedResponse.body.items).toHaveLength(1);
		expect(paginatedResponse.body.total).toBe(2);

		const patientFilterResponse = await request(httpServer)
			.get('/debt-agreements')
			.query({
				clinicId: clinic.id,
				patientId: patientA.id,
				referenceDate: '2026-06-10T15:00:00.000Z',
			});
		expect(patientFilterResponse.status).toBe(200);
		expect(patientFilterResponse.body.items).toHaveLength(1);
		expect(patientFilterResponse.body.items[0]?.id).toBe(
			agreementA.debtAgreementId,
		);

		const statusFilterResponse = await request(httpServer)
			.get('/debt-agreements')
			.query({
				clinicId: clinic.id,
				status: EDebtAgreementStatus.Paid,
				referenceDate: '2026-06-10T15:00:00.000Z',
			});
		expect(statusFilterResponse.status).toBe(200);
		expect(statusFilterResponse.body.items).toHaveLength(1);
		expect(statusFilterResponse.body.items[0]?.id).toBe(
			agreementB.debtAgreementId,
		);
	});

	it('should return resolved referenceDate when list query omits it', async () => {
		const clinic = await createClinic('Clinic Read Default Date');
		const patient = await createPatient(clinic.id, 'Ana', '300');
		await createDebtAgreement({
			clinicId: clinic.id,
			patientId: patient.id,
			totalAmountCents: 300,
			installmentsCount: 1,
			firstDueDate: '2026-06-10T12:00:00.000Z',
		});

		const before = Date.now();
		const response = await request(httpServer).get('/debt-agreements').query({
			clinicId: clinic.id,
		});
		const after = Date.now();

		expect(response.status).toBe(200);
		const resolved = new Date(response.body.referenceDate).getTime();
		expect(Number.isNaN(resolved)).toBe(false);
		expect(resolved).toBeGreaterThanOrEqual(before);
		expect(resolved).toBeLessThanOrEqual(after);
	});

	it('should not cross clinics on list', async () => {
		const clinicA = await createClinic('Clinic A');
		const clinicB = await createClinic('Clinic B');
		const patientA = await createPatient(clinicA.id, 'Ana', '400');
		const patientB = await createPatient(clinicB.id, 'Bruno', '500');

		await createDebtAgreement({
			clinicId: clinicA.id,
			patientId: patientA.id,
			totalAmountCents: 500,
			installmentsCount: 1,
			firstDueDate: '2026-06-10T12:00:00.000Z',
		});
		await createDebtAgreement({
			clinicId: clinicB.id,
			patientId: patientB.id,
			totalAmountCents: 800,
			installmentsCount: 1,
			firstDueDate: '2026-06-10T12:00:00.000Z',
		});

		const response = await request(httpServer).get('/debt-agreements').query({
			clinicId: clinicA.id,
			patientId: patientB.id,
			referenceDate: '2026-06-10T15:00:00.000Z',
		});

		expect(response.status).toBe(200);
		expect(response.body.items).toEqual([]);
		expect(response.body.total).toBe(0);
	});

	it('should return debt agreement detail with installments and derived status', async () => {
		const clinic = await createClinic('Clinic Read Detail');
		const patient = await createPatient(clinic.id, 'Ana', '600');
		const agreement = await createDebtAgreement({
			clinicId: clinic.id,
			patientId: patient.id,
			totalAmountCents: 1_000,
			installmentsCount: 3,
			firstDueDate: '2026-06-01T12:00:00.000Z',
		});

		await db.installment.update({
			where: { id: agreement.installments[0]!.id },
			data: {
				dueDate: new Date('2026-06-01T12:00:00.000Z'),
				status: EInstallmentStatus.PartiallyPaid,
				paidAmountCents: 100,
			},
		});
		await db.installment.update({
			where: { id: agreement.installments[1]!.id },
			data: {
				dueDate: new Date('2026-06-10T12:00:00.000Z'),
			},
		});
		await db.installment.update({
			where: { id: agreement.installments[2]!.id },
			data: {
				dueDate: new Date('2026-07-10T12:00:00.000Z'),
				status: EInstallmentStatus.Paid,
				paidAmountCents: agreement.installments[2]!.amountCents,
				paidAt: new Date('2026-06-05T12:00:00.000Z'),
			},
		});

		const response = await request(httpServer)
			.get(`/debt-agreements/${agreement.debtAgreementId}`)
			.query({
				clinicId: clinic.id,
				referenceDate: '2026-06-10T15:00:00.000Z',
			});

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({
			id: agreement.debtAgreementId,
			clinicId: clinic.id,
			patient: {
				id: patient.id,
				name: 'Ana',
			},
			totalAmountCents: 1_000,
			paidAmountCents: 433,
			remainingAmountCents: 567,
			installmentsCount: 3,
			status: 'ACTIVE',
		});
		expect(response.body.installments).toHaveLength(3);
		expect(
			response.body.installments.map(
				(installment: { derivedStatus: string }) => installment.derivedStatus,
			),
		).toEqual(['OVERDUE', 'DUE_TODAY', 'PAID']);
	});

	it('should return 404 for missing or cross-clinic debt agreement detail', async () => {
		const clinicA = await createClinic('Clinic Detail A');
		const clinicB = await createClinic('Clinic Detail B');
		const patientB = await createPatient(clinicB.id, 'Bruno', '700');
		const agreementB = await createDebtAgreement({
			clinicId: clinicB.id,
			patientId: patientB.id,
			totalAmountCents: 500,
			installmentsCount: 1,
			firstDueDate: '2026-06-10T12:00:00.000Z',
		});

		const notFoundResponse = await request(httpServer)
			.get('/debt-agreements/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
			.query({
				clinicId: clinicA.id,
				referenceDate: '2026-06-10T15:00:00.000Z',
			});
		expect(notFoundResponse.status).toBe(404);
		expect(notFoundResponse.body.detail).toBe('DEBT_AGREEMENT_NOT_FOUND');

		const crossClinicResponse = await request(httpServer)
			.get(`/debt-agreements/${agreementB.debtAgreementId}`)
			.query({
				clinicId: clinicA.id,
				referenceDate: '2026-06-10T15:00:00.000Z',
			});
		expect(crossClinicResponse.status).toBe(404);
		expect(crossClinicResponse.body.detail).toBe('DEBT_AGREEMENT_NOT_FOUND');
	});

	it('should return 422 when detail referenceDate is missing', async () => {
		const clinic = await createClinic('Clinic Missing Reference');
		const patient = await createPatient(clinic.id, 'Ana', '800');
		const agreement = await createDebtAgreement({
			clinicId: clinic.id,
			patientId: patient.id,
			totalAmountCents: 500,
			installmentsCount: 1,
			firstDueDate: '2026-06-10T12:00:00.000Z',
		});

		const response = await request(httpServer)
			.get(`/debt-agreements/${agreement.debtAgreementId}`)
			.query({
				clinicId: clinic.id,
			});

		expect(response.status).toBe(422);
		expect(response.body.detail).toBe('INVALID_DEBT_AGREEMENT_QUERY');
	});
});
