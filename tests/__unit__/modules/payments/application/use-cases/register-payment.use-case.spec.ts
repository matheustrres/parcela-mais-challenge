import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { MockProxy } from 'vitest-mock-extended';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { TransactionManager } from '@/@core/application/transaction-manager';
import { DomainException } from '@/@core/domain/exceptions/domain-exception';
import { EInstallmentStatus, EPaymentMethod } from '@/@core/enums/domain';

import { InstallmentRepository } from '@/modules/installments/application/repositories/installment.repository';
import { PaymentRepository } from '@/modules/payments/application/repositories/payment.repository';
import { PaymentIdempotencyPayloadHasherService } from '@/modules/payments/application/services/payment-idempotency-payload-hasher.service';
import { RegisterPaymentUseCase } from '@/modules/payments/application/use-cases/register-payment.use-case';

import { buildInstallmentEntity } from '#/data/builders/entities/installment.entity.builder';
import { buildPaymentEntity } from '#/data/builders/entities/payment.entity.builder';
import { makeInstallmentRepositoryMock } from '#/data/mocks/repositories/installment.repository.mock';
import { makePaymentRepositoryMock } from '#/data/mocks/repositories/payment.repository.mock';
import { makePaymentIdempotencyPayloadHasherServiceMock } from '#/data/mocks/services/payment-idempotency-payload-hasher.service.mock';
import {
	makeTransactionManagerMock,
	TransactionManagerMockBundle,
} from '#/data/mocks/services/transaction-manager.mock';

describe('RegisterPaymentUseCase', () => {
	let installmentRepository: MockProxy<InstallmentRepository>;
	let paymentRepository: MockProxy<PaymentRepository>;
	let paymentIdempotencyPayloadHasher: MockProxy<PaymentIdempotencyPayloadHasherService>;
	let transactionManagerBundle: TransactionManagerMockBundle;
	let useCase: RegisterPaymentUseCase;

	const clinicId = 'clinic-1';
	const installmentId = 'installment-1';
	const paidAt = new Date('2026-01-12T15:30:00.000Z');

	beforeEach(() => {
		installmentRepository = makeInstallmentRepositoryMock();
		paymentRepository = makePaymentRepositoryMock();
		paymentIdempotencyPayloadHasher =
			makePaymentIdempotencyPayloadHasherServiceMock();
		transactionManagerBundle = makeTransactionManagerMock();
		useCase = new RegisterPaymentUseCase(
			installmentRepository,
			paymentRepository,
			paymentIdempotencyPayloadHasher,
			transactionManagerBundle.transactionManager as TransactionManager,
		);
		paymentIdempotencyPayloadHasher.hash.mockReturnValue('hash-1');
		paymentRepository.create.mockResolvedValue();
		installmentRepository.update.mockResolvedValue();
		paymentRepository.findByClinicIdAndIdempotencyKey.mockResolvedValue(null);
		paymentRepository.findByClinicIdAndExternalReference.mockResolvedValue(
			null,
		);
	});

	it('should register a full payment and mark installment as paid', async () => {
		const installment = buildInstallmentEntity({
			id: installmentId,
			clinicId,
			amountCents: 1_000,
		});
		installmentRepository.findByIdAndClinicId.mockResolvedValue(installment);

		const output = await useCase.exec({
			clinicId,
			installmentId,
			amountCents: 1_000,
			method: EPaymentMethod.Pix,
			externalReference: ' ext-1 ',
			idempotencyKey: 'idem-1',
			paidAt,
		});

		expect(
			transactionManagerBundle.transactionManager.run,
		).toHaveBeenCalledOnce();
		expect(paymentIdempotencyPayloadHasher.hash).toHaveBeenCalledWith({
			clinicId,
			installmentId,
			amountCents: 1_000,
			method: EPaymentMethod.Pix,
			externalReference: 'ext-1',
			paidAt,
		});
		expect(paymentRepository.create).toHaveBeenCalledOnce();
		expect(installmentRepository.update).toHaveBeenCalledOnce();
		expect(output.amountCents).toBe(1_000);
		expect(output.installmentStatus).toBe(EInstallmentStatus.Paid);
		expect(output.installmentPaidAmountCents).toBe(1_000);
		expect(output.installmentRemainingAmountCents).toBe(0);
		expect(output.externalReference).toBe('ext-1');
		expect(output.idempotencyKey).toBe('idem-1');
	});

	it('should register a partial payment and keep installment paidAt null', async () => {
		const installment = buildInstallmentEntity({
			id: installmentId,
			clinicId,
			amountCents: 1_000,
		});
		installmentRepository.findByIdAndClinicId.mockResolvedValue(installment);

		const output = await useCase.exec({
			clinicId,
			installmentId,
			amountCents: 400,
			method: EPaymentMethod.Pix,
			idempotencyKey: 'idem-1',
			paidAt,
		});

		expect(output.installmentStatus).toBe(EInstallmentStatus.PartiallyPaid);
		expect(output.installmentPaidAmountCents).toBe(400);
		expect(output.installmentRemainingAmountCents).toBe(600);
		const [updatedInstallment] = installmentRepository.update.mock.calls[0]!;
		expect(updatedInstallment.paidAt).toBeNull();
	});

	it('should return existing payment for same idempotency key and same payload', async () => {
		const installment = buildInstallmentEntity({
			id: installmentId,
			clinicId,
			amountCents: 1_000,
			paidAmountCents: 400,
			status: EInstallmentStatus.PartiallyPaid,
			version: 1,
		});
		const existingPayment = buildPaymentEntity({
			clinicId,
			installmentId,
			amountCents: 400,
			idempotencyKey: 'idem-1',
			idempotencyPayloadHash: 'hash-1',
		});
		installmentRepository.findByIdAndClinicId.mockResolvedValue(installment);
		paymentRepository.findByClinicIdAndIdempotencyKey.mockResolvedValue(
			existingPayment,
		);

		const output = await useCase.exec({
			clinicId,
			installmentId,
			amountCents: 400,
			method: EPaymentMethod.Pix,
			idempotencyKey: 'idem-1',
			paidAt,
		});

		expect(output.paymentId).toBe(existingPayment.id.toString());
		expect(paymentRepository.create).not.toHaveBeenCalled();
		expect(installmentRepository.update).not.toHaveBeenCalled();
	});

	it('should throw when same idempotency key has different payload', async () => {
		installmentRepository.findByIdAndClinicId.mockResolvedValue(
			buildInstallmentEntity({ id: installmentId, clinicId }),
		);
		paymentRepository.findByClinicIdAndIdempotencyKey.mockResolvedValue(
			buildPaymentEntity({
				clinicId,
				installmentId,
				idempotencyKey: 'idem-1',
				idempotencyPayloadHash: 'other-hash',
			}),
		);

		await expect(
			useCase.exec({
				clinicId,
				installmentId,
				amountCents: 1_000,
				method: EPaymentMethod.Pix,
				idempotencyKey: 'idem-1',
				paidAt,
			}),
		).rejects.toThrowError(
			new ApplicationException('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH'),
		);
	});

	it('should return existing payment for same external reference and same payload', async () => {
		const installment = buildInstallmentEntity({
			id: installmentId,
			clinicId,
			amountCents: 1_000,
			paidAmountCents: 400,
			status: EInstallmentStatus.PartiallyPaid,
			version: 1,
		});
		const existingPayment = buildPaymentEntity({
			clinicId,
			installmentId,
			amountCents: 400,
			externalReference: 'ext-1',
			idempotencyKey: 'idem-existing',
			idempotencyPayloadHash: 'hash-1',
		});
		installmentRepository.findByIdAndClinicId.mockResolvedValue(installment);
		paymentRepository.findByClinicIdAndIdempotencyKey.mockResolvedValue(null);
		paymentRepository.findByClinicIdAndExternalReference.mockResolvedValue(
			existingPayment,
		);

		const output = await useCase.exec({
			clinicId,
			installmentId,
			amountCents: 400,
			method: EPaymentMethod.Pix,
			externalReference: ' ext-1 ',
			idempotencyKey: 'idem-new',
			paidAt,
		});

		expect(output.idempotencyKey).toBe('idem-existing');
		expect(paymentRepository.create).not.toHaveBeenCalled();
	});

	it('should throw when same external reference has different payload', async () => {
		installmentRepository.findByIdAndClinicId.mockResolvedValue(
			buildInstallmentEntity({ id: installmentId, clinicId }),
		);
		paymentRepository.findByClinicIdAndExternalReference.mockResolvedValue(
			buildPaymentEntity({
				clinicId,
				installmentId,
				externalReference: 'ext-1',
				idempotencyPayloadHash: 'other-hash',
			}),
		);

		await expect(
			useCase.exec({
				clinicId,
				installmentId,
				amountCents: 1_000,
				method: EPaymentMethod.Pix,
				externalReference: 'ext-1',
				idempotencyKey: 'idem-1',
				paidAt,
			}),
		).rejects.toThrowError(
			new ApplicationException('EXTERNAL_REFERENCE_PAYLOAD_MISMATCH'),
		);
	});

	it('should throw when installment is not found', async () => {
		installmentRepository.findByIdAndClinicId.mockResolvedValue(null);

		await expect(
			useCase.exec({
				clinicId,
				installmentId,
				amountCents: 1_000,
				method: EPaymentMethod.Pix,
				idempotencyKey: 'idem-1',
				paidAt,
			}),
		).rejects.toThrowError(new ApplicationException('INSTALLMENT_NOT_FOUND'));
	});

	it('should throw when installment is already paid for a new payment', async () => {
		installmentRepository.findByIdAndClinicId.mockResolvedValue(
			buildInstallmentEntity({
				id: installmentId,
				clinicId,
				amountCents: 1_000,
				paidAmountCents: 1_000,
				status: EInstallmentStatus.Paid,
				paidAt,
			}),
		);

		await expect(
			useCase.exec({
				clinicId,
				installmentId,
				amountCents: 100,
				method: EPaymentMethod.Pix,
				idempotencyKey: 'idem-1',
				paidAt,
			}),
		).rejects.toThrowError(
			new ApplicationException('INSTALLMENT_ALREADY_PAID'),
		);
	});

	it('should throw when amount exceeds remaining balance', async () => {
		installmentRepository.findByIdAndClinicId.mockResolvedValue(
			buildInstallmentEntity({
				id: installmentId,
				clinicId,
				amountCents: 1_000,
				paidAmountCents: 900,
				status: EInstallmentStatus.PartiallyPaid,
				version: 1,
			}),
		);

		await expect(
			useCase.exec({
				clinicId,
				installmentId,
				amountCents: 200,
				method: EPaymentMethod.Pix,
				idempotencyKey: 'idem-1',
				paidAt,
			}),
		).rejects.toThrowError(
			new ApplicationException('PAYMENT_AMOUNT_EXCEEDS_INSTALLMENT_BALANCE'),
		);
	});

	it('should fail in controlled way when paidAt is invalid', async () => {
		await expect(
			useCase.exec({
				clinicId,
				installmentId,
				amountCents: 200,
				method: EPaymentMethod.Pix,
				idempotencyKey: 'idem-1',
				paidAt: new Date('invalid'),
			}),
		).rejects.toThrowError(new ApplicationException('INVALID_PAYMENT_PAID_AT'));
	});

	it('should not update installment when payment create fails', async () => {
		installmentRepository.findByIdAndClinicId.mockResolvedValue(
			buildInstallmentEntity({ id: installmentId, clinicId }),
		);
		paymentRepository.create.mockRejectedValueOnce(new Error('db fail'));

		await expect(
			useCase.exec({
				clinicId,
				installmentId,
				amountCents: 1_000,
				method: EPaymentMethod.Pix,
				idempotencyKey: 'idem-1',
				paidAt,
			}),
		).rejects.toThrowError('db fail');

		expect(installmentRepository.update).not.toHaveBeenCalled();
	});

	it('should propagate installment update failure', async () => {
		installmentRepository.findByIdAndClinicId.mockResolvedValue(
			buildInstallmentEntity({ id: installmentId, clinicId }),
		);
		installmentRepository.update.mockRejectedValueOnce(
			new ApplicationException('INSTALLMENT_CONCURRENT_MODIFICATION'),
		);

		await expect(
			useCase.exec({
				clinicId,
				installmentId,
				amountCents: 1_000,
				method: EPaymentMethod.Pix,
				idempotencyKey: 'idem-1',
				paidAt,
			}),
		).rejects.toThrowError(
			new ApplicationException('INSTALLMENT_CONCURRENT_MODIFICATION'),
		);
	});

	it('should resolve duplicate safely after unique violation race', async () => {
		const currentInstallment = buildInstallmentEntity({
			id: installmentId,
			clinicId,
			amountCents: 1_000,
			paidAmountCents: 1_000,
			status: EInstallmentStatus.Paid,
			paidAt,
			version: 1,
		});
		const existingPayment = buildPaymentEntity({
			clinicId,
			installmentId,
			idempotencyKey: 'idem-1',
			idempotencyPayloadHash: 'hash-1',
			paidAt,
		});
		installmentRepository.findByIdAndClinicId
			.mockResolvedValueOnce(
				buildInstallmentEntity({
					id: installmentId,
					clinicId,
					amountCents: 1_000,
				}),
			)
			.mockResolvedValueOnce(currentInstallment);
		paymentRepository.create.mockRejectedValueOnce(
			new Prisma.PrismaClientKnownRequestError('duplicate', {
				code: 'P2002',
				clientVersion: '7.0.1',
			}),
		);
		paymentRepository.findByClinicIdAndIdempotencyKey
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(existingPayment);

		const output = await useCase.exec({
			clinicId,
			installmentId,
			amountCents: 1_000,
			method: EPaymentMethod.Pix,
			idempotencyKey: 'idem-1',
			paidAt,
		});

		expect(output.paymentId).toBe(existingPayment.id.toString());
		expect(output.installmentStatus).toBe(EInstallmentStatus.Paid);
	});

	it('should preserve domain validation for non-positive amount', async () => {
		installmentRepository.findByIdAndClinicId.mockResolvedValue(
			buildInstallmentEntity({ id: installmentId, clinicId }),
		);

		await expect(
			useCase.exec({
				clinicId,
				installmentId,
				amountCents: 0,
				method: EPaymentMethod.Pix,
				idempotencyKey: 'idem-1',
				paidAt,
			}),
		).rejects.toThrowError(
			new DomainException('PAYMENT_AMOUNT_MUST_BE_POSITIVE'),
		);
	});
});
