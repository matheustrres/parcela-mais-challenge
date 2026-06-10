import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createAppFixture } from '../__helpers/app-fixture';
import { cleanDatabase } from '../__helpers/database-cleaner';

import {
	ECommunicationChannel,
	EContactStatus,
	EInstallmentStatus,
} from '@/@core/enums/domain';

import { DatabaseService } from '@/shared/modules/database/database.service';

describe('DebtAgreements API (e2e)', () => {
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

	it('should create debt agreement, divide cents correctly and expose installments', async () => {
		const clinic = await db.clinic.create({
			data: { name: 'Clinic Debt Agreements' },
		});
		const patient = await db.patient.create({
			data: {
				clinicId: clinic.id,
				name: 'Ana Parcelada',
				email: 'ana.parcelada@example.com',
				phone: '11999999999',
				preferredChannel: ECommunicationChannel.WhatsApp,
				contactStatus: EContactStatus.Active,
			},
		});

		const createResponse = await request(httpServer)
			.post('/debt-agreements')
			.send({
				clinicId: clinic.id,
				patientId: patient.id,
				totalAmountCents: 1_000,
				installmentsCount: 3,
				firstDueDate: '2026-06-10T12:00:00.000Z',
			});

		expect(createResponse.status).toBe(201);
		expect(
			createResponse.body.installments.map(
				(installment: { amountCents: number }) => installment.amountCents,
			),
		).toEqual([334, 333, 333]);

		const listResponse = await request(httpServer).get('/installments').query({
			clinicId: clinic.id,
			referenceDate: '2026-06-10T15:00:00.000Z',
			limit: '10',
			offset: '0',
		});

		expect(listResponse.status).toBe(200);
		expect(listResponse.body.items).toHaveLength(3);
		expect(listResponse.body.items[0]).toMatchObject({
			installmentNumber: 1,
			status: EInstallmentStatus.Pending,
			derivedStatus: 'DUE_TODAY',
		});
	});

	it('should reject patient from another clinic', async () => {
		const clinicA = await db.clinic.create({
			data: { name: 'Clinic A' },
		});
		const clinicB = await db.clinic.create({
			data: { name: 'Clinic B' },
		});
		const patient = await db.patient.create({
			data: {
				clinicId: clinicB.id,
				name: 'Paciente Outra Clinica',
				email: 'outra.clinica@example.com',
				phone: '11911111111',
				preferredChannel: ECommunicationChannel.WhatsApp,
				contactStatus: EContactStatus.Active,
			},
		});

		const response = await request(httpServer).post('/debt-agreements').send({
			clinicId: clinicA.id,
			patientId: patient.id,
			totalAmountCents: 1_000,
			installmentsCount: 2,
			firstDueDate: '2026-06-10T12:00:00.000Z',
		});

		expect(response.status).toBe(422);
		expect(response.body.detail).toBe('PATIENT_DOES_NOT_BELONG_TO_CLINIC');
	});
});
