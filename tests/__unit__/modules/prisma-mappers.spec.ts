import { describe, expect, it } from 'vitest';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import {
	ECommunicationChannel,
	ECommunicationStatus,
	ECommunicationType,
	EContactStatus,
	EDebtAgreementStatus,
	EInstallmentStatus,
	EPaymentMethod,
} from '@/@core/enums/domain';

import { ClinicPrismaMapper } from '@/modules/clinics/infrastructure/prisma/clinic-prisma.mapper';
import { CommunicationAttemptEntity } from '@/modules/communications/domain/entities/communication-attempt.entity';
import { CommunicationAttemptPrismaMapper } from '@/modules/communications/infrastructure/prisma/communication-attempt-prisma.mapper';
import { DebtAgreementEntity } from '@/modules/debt-agreements/domain/entities/debt-agreement.entity';
import { DebtAgreementPrismaMapper } from '@/modules/debt-agreements/infrastructure/prisma/debt-agreement-prisma.mapper';
import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { InstallmentPrismaMapper } from '@/modules/installments/infrastructure/prisma/installment-prisma.mapper';
import { PatientPrismaMapper } from '@/modules/patients/infrastructure/prisma/patient-prisma.mapper';
import { PaymentEntity } from '@/modules/payments/domain/entities/payment.entity';
import { PaymentPrismaMapper } from '@/modules/payments/infrastructure/prisma/payment-prisma.mapper';

describe('ClinicPrismaMapper', () => {
	describe('.toDomain', () => {
		it('maps clinic prisma record to domain entity preserving meta', () => {
			const createdAt = new Date('2026-06-01T10:00:00.000Z');
			const updatedAt = new Date('2026-06-02T10:00:00.000Z');

			const clinic = ClinicPrismaMapper.toDomain({
				id: 'clinic-1',
				name: ' Clinic Alpha ',
				createdAt,
				updatedAt,
			});

			expect(clinic.id.toString()).toBe('clinic-1');
			expect(clinic.name).toBe('Clinic Alpha');
			expect(clinic.createdAt).toBe(createdAt);
			expect(clinic.updatedAt).toBe(updatedAt);
		});
	});
});

describe('PatientPrismaMapper', () => {
	describe('.toDomain', () => {
		it('should map patient prisma record to domain entity preserving nullables and enums', () => {
			const createdAt = new Date('2026-06-01T10:00:00.000Z');
			const updatedAt = new Date('2026-06-02T10:00:00.000Z');

			const patient = PatientPrismaMapper.toDomain({
				id: 'patient-1',
				clinicId: 'clinic-1',
				name: 'Maria',
				email: 'MARIA@EMAIL.COM',
				phone: '11999999999',
				preferredChannel: ECommunicationChannel.Email,
				contactStatus: EContactStatus.Active,
				createdAt,
				updatedAt,
			});

			expect(patient.id.toString()).toBe('patient-1');
			expect(patient.clinicId.toString()).toBe('clinic-1');
			expect(patient.email).toBe('maria@email.com');
			expect(patient.preferredChannel).toBe(ECommunicationChannel.Email);
			expect(patient.contactStatus).toBe(EContactStatus.Active);
			expect(patient.createdAt).toBe(createdAt);
			expect(patient.updatedAt).toBe(updatedAt);
		});
	});
});

describe('DebtAgreementPrismaMapper', () => {
	describe('.toDomain', () => {
		it('maps debt agreement prisma record to domain entity with cents to MoneyVo', () => {
			const agreement = DebtAgreementPrismaMapper.toDomain({
				id: 'agreement-1',
				clinicId: 'clinic-1',
				patientId: 'patient-1',
				totalAmountCents: 15234,
				installmentsCount: 6,
				status: EDebtAgreementStatus.Active,
				createdAt: new Date('2026-06-01T10:00:00.000Z'),
				updatedAt: new Date('2026-06-02T10:00:00.000Z'),
			});

			expect(agreement.totalAmount.getCents()).toBe(15234);
			expect(agreement.status).toBe(EDebtAgreementStatus.Active);
			expect(agreement.installmentsCount).toBe(6);
		});
	});

	describe('.toPersistence', () => {
		it('maps entity to prisma persistence payload', () => {
			const createdAt = new Date('2026-06-01T10:00:00.000Z');
			const updatedAt = new Date('2026-06-02T10:00:00.000Z');
			const agreement = DebtAgreementEntity.createFrom(
				EntityUuid.createFrom('agreement-1'),
				{
					clinicId: EntityUuid.createFrom('clinic-1'),
					patientId: EntityUuid.createFrom('patient-1'),
					totalAmount: MoneyVo.fromCents(15234),
					installmentsCount: 6,
					status: EDebtAgreementStatus.Active,
				},
				{ createdAt, updatedAt },
			);

			expect(DebtAgreementPrismaMapper.toPersistence(agreement)).toEqual({
				id: 'agreement-1',
				clinicId: 'clinic-1',
				patientId: 'patient-1',
				totalAmountCents: 15234,
				installmentsCount: 6,
				status: EDebtAgreementStatus.Active,
				createdAt,
				updatedAt,
			});
		});
	});
});

describe('InstallmentPrismaMapper', () => {
	describe('.toDomain', () => {
		it('maps installment prisma record to domain entity with payment fields', () => {
			const dueDate = new Date('2026-06-10T00:00:00.000Z');
			const paidAt = new Date('2026-06-11T12:00:00.000Z');

			const installment = InstallmentPrismaMapper.toDomain({
				id: 'installment-1',
				clinicId: 'clinic-1',
				debtAgreementId: 'agreement-1',
				installmentNumber: 2,
				dueDate,
				amountCents: 8000,
				paidAmountCents: 3000,
				status: EInstallmentStatus.PartiallyPaid,
				paidAt,
				version: 3,
				createdAt: new Date('2026-06-01T10:00:00.000Z'),
				updatedAt: new Date('2026-06-02T10:00:00.000Z'),
			});

			expect(installment.amount.getCents()).toBe(8000);
			expect(installment.paidAmount.getCents()).toBe(3000);
			expect(installment.paidAt).toBe(paidAt);
			expect(installment.version).toBe(3);
		});
	});

	describe('.toPersistence', () => {
		it('maps entity to prisma create payload', () => {
			const createdAt = new Date('2026-06-01T10:00:00.000Z');
			const updatedAt = new Date('2026-06-02T10:00:00.000Z');
			const dueDate = new Date('2026-06-10T00:00:00.000Z');
			const normalizedDueDate = new Date('2026-06-10T12:00:00.000Z');
			const paidAt = new Date('2026-06-11T12:00:00.000Z');
			const installment = InstallmentEntity.createFrom(
				EntityUuid.createFrom('installment-1'),
				{
					clinicId: EntityUuid.createFrom('clinic-1'),
					debtAgreementId: EntityUuid.createFrom('agreement-1'),
					installmentNumber: 1,
					dueDate,
					amount: MoneyVo.fromCents(4000),
					paidAmount: MoneyVo.fromCents(4000),
					status: EInstallmentStatus.Paid,
					paidAt,
					version: 4,
				},
				{ createdAt, updatedAt },
			);

			expect(InstallmentPrismaMapper.toPersistence(installment)).toEqual({
				id: 'installment-1',
				clinicId: 'clinic-1',
				debtAgreementId: 'agreement-1',
				installmentNumber: 1,
				dueDate: normalizedDueDate,
				amountCents: 4000,
				paidAmountCents: 4000,
				status: EInstallmentStatus.Paid,
				paidAt,
				version: 4,
				createdAt,
				updatedAt,
			});
		});
	});

	describe('.toUpdatePersistence', () => {
		it('maps entity to prisma update payload', () => {
			const createdAt = new Date('2026-06-01T10:00:00.000Z');
			const updatedAt = new Date('2026-06-02T10:00:00.000Z');
			const dueDate = new Date('2026-06-10T00:00:00.000Z');
			const paidAt = new Date('2026-06-11T12:00:00.000Z');
			const installment = InstallmentEntity.createFrom(
				EntityUuid.createFrom('installment-1'),
				{
					clinicId: EntityUuid.createFrom('clinic-1'),
					debtAgreementId: EntityUuid.createFrom('agreement-1'),
					installmentNumber: 1,
					dueDate,
					amount: MoneyVo.fromCents(4000),
					paidAmount: MoneyVo.fromCents(4000),
					status: EInstallmentStatus.Paid,
					paidAt,
					version: 4,
				},
				{ createdAt, updatedAt },
			);

			expect(InstallmentPrismaMapper.toUpdatePersistence(installment)).toEqual({
				paidAmountCents: 4000,
				status: EInstallmentStatus.Paid,
				paidAt,
				version: 4,
				updatedAt,
			});
		});
	});
});

describe('PaymentPrismaMapper', () => {
	describe('.toDomain', () => {
		it('maps payment prisma record to domain entity with nullable externalReference', () => {
			const payment = PaymentPrismaMapper.toDomain({
				id: 'payment-1',
				clinicId: 'clinic-1',
				installmentId: 'installment-1',
				amountCents: 5000,
				method: EPaymentMethod.Manual,
				externalReference: null,
				idempotencyKey: 'idem-1',
				idempotencyPayloadHash: 'hash-1',
				paidAt: new Date('2026-06-11T12:00:00.000Z'),
				createdAt: new Date('2026-06-11T12:01:00.000Z'),
			});

			expect(payment.amount.getCents()).toBe(5000);
			expect(payment.externalReference).toBeNull();
			expect(payment.method).toBe(EPaymentMethod.Manual);
			expect(payment.idempotencyPayloadHash).toBe('hash-1');
		});
	});

	describe('.toPersistence', () => {
		it('maps entity to prisma persistence payload', () => {
			const createdAt = new Date('2026-06-01T10:00:00.000Z');
			const paidAt = new Date('2026-06-11T12:00:00.000Z');
			const payment = PaymentEntity.createFrom(
				EntityUuid.createFrom('payment-1'),
				{
					clinicId: EntityUuid.createFrom('clinic-1'),
					installmentId: EntityUuid.createFrom('installment-1'),
					amount: MoneyVo.fromCents(4000),
					method: EPaymentMethod.Pix,
					externalReference: null,
					idempotencyKey: 'idem-1',
					idempotencyPayloadHash: 'hash-1',
					paidAt,
				},
				{ createdAt },
			);

			expect(PaymentPrismaMapper.toPersistence(payment)).toEqual({
				id: 'payment-1',
				clinicId: 'clinic-1',
				installmentId: 'installment-1',
				amountCents: 4000,
				method: EPaymentMethod.Pix,
				externalReference: null,
				idempotencyKey: 'idem-1',
				idempotencyPayloadHash: 'hash-1',
				paidAt,
				createdAt,
			});
		});
	});
});

describe('CommunicationAttemptPrismaMapper', () => {
	describe('.toDomain', () => {
		it('maps communication attempt prisma record to domain entity preserving nullable fields', () => {
			const attempt = CommunicationAttemptPrismaMapper.toDomain({
				id: 'attempt-1',
				clinicId: 'clinic-1',
				patientId: 'patient-1',
				installmentId: 'installment-1',
				type: ECommunicationType.PaymentConfirmation,
				channel: ECommunicationChannel.Email,
				status: ECommunicationStatus.Generated,
				scheduledFor: null,
				sentAt: null,
				skippedReason: null,
				message: 'Confirma pagamento',
				aiGenerated: false,
				templateKey: null,
				createdAt: new Date('2026-06-11T12:01:00.000Z'),
				updatedAt: new Date('2026-06-11T12:02:00.000Z'),
			});

			expect(attempt.type).toBe(ECommunicationType.PaymentConfirmation);
			expect(attempt.channel).toBe(ECommunicationChannel.Email);
			expect(attempt.scheduledFor).toBeNull();
			expect(attempt.sentAt).toBeNull();
			expect(attempt.templateKey).toBeNull();
		});
	});

	describe('.toPersistence', () => {
		it('maps entity to prisma persistence payload', () => {
			const createdAt = new Date('2026-06-01T10:00:00.000Z');
			const updatedAt = new Date('2026-06-02T10:00:00.000Z');
			const scheduledFor = new Date('2026-06-09T09:00:00.000Z');
			const attempt = CommunicationAttemptEntity.createFrom(
				EntityUuid.createFrom('attempt-1'),
				{
					clinicId: EntityUuid.createFrom('clinic-1'),
					patientId: EntityUuid.createFrom('patient-1'),
					installmentId: EntityUuid.createFrom('installment-1'),
					type: ECommunicationType.DueDateReminder,
					channel: ECommunicationChannel.WhatsApp,
					status: ECommunicationStatus.Pending,
					scheduledFor,
					sentAt: null,
					skippedReason: null,
					message: 'Lembrete',
					aiGenerated: true,
					templateKey: 'due-date-reminder',
				},
				{ createdAt, updatedAt },
			);

			expect(CommunicationAttemptPrismaMapper.toPersistence(attempt)).toEqual({
				id: 'attempt-1',
				clinicId: 'clinic-1',
				patientId: 'patient-1',
				installmentId: 'installment-1',
				type: ECommunicationType.DueDateReminder,
				channel: ECommunicationChannel.WhatsApp,
				status: ECommunicationStatus.Pending,
				scheduledFor,
				sentAt: null,
				skippedReason: null,
				message: 'Lembrete',
				aiGenerated: true,
				templateKey: 'due-date-reminder',
				createdAt,
				updatedAt,
			});
		});
	});
});
