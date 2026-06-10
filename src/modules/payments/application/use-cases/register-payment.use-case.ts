import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { TransactionManager } from '@/@core/application/transaction-manager';
import { UseCase } from '@/@core/application/use-case';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { EInstallmentStatus, EPaymentMethod } from '@/@core/enums/domain';

import { InstallmentRepository } from '@/modules/installments/application/repositories/installment.repository';
import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { PaymentRepository } from '@/modules/payments/application/repositories/payment.repository';
import { PaymentIdempotencyPayloadHasherService } from '@/modules/payments/application/services/payment-idempotency-payload-hasher.service';
import { PaymentEntity } from '@/modules/payments/domain/entities/payment.entity';

export type RegisterPaymentInput = {
	clinicId: string;
	installmentId: string;
	amountCents: number;
	method: EPaymentMethod;
	externalReference?: string | null;
	idempotencyKey: string;
	paidAt: Date;
};

export type RegisterPaymentOutput = {
	paymentId: string;
	installmentId: string;
	amountCents: number;
	method: EPaymentMethod;
	externalReference: string | null;
	idempotencyKey: string;
	paidAt: Date;
	installmentStatus: EInstallmentStatus;
	installmentPaidAmountCents: number;
	installmentRemainingAmountCents: number;
	reused: boolean;
};

@Injectable()
export class RegisterPaymentUseCase implements UseCase<
	RegisterPaymentInput,
	RegisterPaymentOutput
> {
	constructor(
		private readonly installmentRepository: InstallmentRepository,
		private readonly paymentRepository: PaymentRepository,
		private readonly paymentIdempotencyPayloadHasher: PaymentIdempotencyPayloadHasherService,
		private readonly transactionManager: TransactionManager,
	) {}

	async exec(input: RegisterPaymentInput): Promise<RegisterPaymentOutput> {
		const clinicId = EntityUuid.createFrom(input.clinicId);
		const installmentId = EntityUuid.createFrom(input.installmentId);
		const externalReference = this.normalizeExternalReference(
			input.externalReference,
		);
		const paidAt = this.ensureValidPaidAt(input.paidAt);

		const installment = await this.installmentRepository.findByIdAndClinicId(
			installmentId,
			clinicId,
		);
		if (!installment) {
			throw new ApplicationException('INSTALLMENT_NOT_FOUND');
		}

		const payloadHash = this.paymentIdempotencyPayloadHasher.hash({
			clinicId: clinicId.toString(),
			installmentId: installmentId.toString(),
			amountCents: input.amountCents,
			method: input.method,
			externalReference,
			paidAt,
		});

		const paymentByIdempotencyKey =
			await this.paymentRepository.findByClinicIdAndIdempotencyKey(
				clinicId,
				input.idempotencyKey,
			);
		if (paymentByIdempotencyKey) {
			return this.handleDuplicatePayment(
				paymentByIdempotencyKey,
				payloadHash,
				installment,
				'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
			);
		}

		if (externalReference) {
			const paymentByExternalReference =
				await this.paymentRepository.findByClinicIdAndExternalReference(
					clinicId,
					externalReference,
				);
			if (paymentByExternalReference) {
				return this.handleDuplicatePayment(
					paymentByExternalReference,
					payloadHash,
					installment,
					'EXTERNAL_REFERENCE_PAYLOAD_MISMATCH',
				);
			}
		}

		if (installment.isPaid()) {
			throw new ApplicationException('INSTALLMENT_ALREADY_PAID');
		}

		const amount = MoneyVo.fromCents(input.amountCents);
		if (amount.isGreaterThan(installment.getRemainingAmount())) {
			throw new ApplicationException(
				'PAYMENT_AMOUNT_EXCEEDS_INSTALLMENT_BALANCE',
			);
		}

		const payment = PaymentEntity.create({
			clinicId,
			installmentId,
			amount,
			method: input.method,
			externalReference,
			idempotencyKey: input.idempotencyKey,
			idempotencyPayloadHash: payloadHash,
			paidAt,
		});

		installment.registerPayment(amount, paidAt);

		try {
			return await this.transactionManager.run(async (tx) => {
				await this.paymentRepository.create(payment, tx);
				await this.installmentRepository.update(installment, tx);
				return this.toOutput(payment, installment);
			});
		} catch (error) {
			if (this.isUniqueConstraintError(error)) {
				return this.resolveDuplicateAfterUniqueViolation({
					clinicId,
					idempotencyKey: input.idempotencyKey,
					externalReference,
					payloadHash,
				});
			}

			throw error;
		}
	}

	private async resolveDuplicateAfterUniqueViolation(input: {
		clinicId: EntityUuid;
		idempotencyKey: string;
		externalReference: string | null;
		payloadHash: string;
	}): Promise<RegisterPaymentOutput> {
		const paymentByIdempotencyKey =
			await this.paymentRepository.findByClinicIdAndIdempotencyKey(
				input.clinicId,
				input.idempotencyKey,
			);
		if (paymentByIdempotencyKey) {
			return this.returnExistingAfterRace(
				paymentByIdempotencyKey,
				input.payloadHash,
				'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
			);
		}

		if (input.externalReference) {
			const paymentByExternalReference =
				await this.paymentRepository.findByClinicIdAndExternalReference(
					input.clinicId,
					input.externalReference,
				);
			if (paymentByExternalReference) {
				return this.returnExistingAfterRace(
					paymentByExternalReference,
					input.payloadHash,
					'EXTERNAL_REFERENCE_PAYLOAD_MISMATCH',
				);
			}
		}

		throw new ApplicationException('INSTALLMENT_CONCURRENT_MODIFICATION');
	}

	private async returnExistingAfterRace(
		payment: PaymentEntity,
		payloadHash: string,
		mismatchCode:
			| 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH'
			| 'EXTERNAL_REFERENCE_PAYLOAD_MISMATCH',
	): Promise<RegisterPaymentOutput> {
		const installmentId = EntityUuid.createFrom(
			payment.installmentId.toString(),
		);
		const clinicId = EntityUuid.createFrom(payment.clinicId.toString());
		const installment = await this.installmentRepository.findByIdAndClinicId(
			installmentId,
			clinicId,
		);
		if (!installment) {
			throw new ApplicationException('INSTALLMENT_NOT_FOUND');
		}

		return this.handleDuplicatePayment(
			payment,
			payloadHash,
			installment,
			mismatchCode,
		);
	}

	private handleDuplicatePayment(
		payment: PaymentEntity,
		payloadHash: string,
		installment: InstallmentEntity,
		mismatchCode:
			| 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH'
			| 'EXTERNAL_REFERENCE_PAYLOAD_MISMATCH',
	): RegisterPaymentOutput {
		if (payment.idempotencyPayloadHash !== payloadHash) {
			throw new ApplicationException(mismatchCode);
		}
		return {
			...this.toOutput(payment, installment),
			reused: true,
		};
	}

	private toOutput(
		payment: PaymentEntity,
		installment: InstallmentEntity,
	): RegisterPaymentOutput {
		return {
			paymentId: payment.id.toString(),
			installmentId: payment.installmentId.toString(),
			amountCents: payment.amount.getCents(),
			method: payment.method,
			externalReference: payment.externalReference,
			idempotencyKey: payment.idempotencyKey,
			paidAt: payment.paidAt,
			installmentStatus: installment.status,
			installmentPaidAmountCents: installment.paidAmount.getCents(),
			installmentRemainingAmountCents: installment
				.getRemainingAmount()
				.getCents(),
			reused: false,
		};
	}

	private normalizeExternalReference(
		externalReference?: string | null,
	): string | null {
		return externalReference?.trim() ? externalReference.trim() : null;
	}

	private ensureValidPaidAt(paidAt: Date): Date {
		if (!(paidAt instanceof Date) || Number.isNaN(paidAt.getTime())) {
			throw new ApplicationException('INVALID_PAYMENT_PAID_AT');
		}
		return paidAt;
	}

	private isUniqueConstraintError(
		error: unknown,
	): error is Prisma.PrismaClientKnownRequestError {
		return (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === 'P2002'
		);
	}
}
