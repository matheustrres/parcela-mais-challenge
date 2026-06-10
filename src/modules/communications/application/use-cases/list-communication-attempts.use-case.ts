import { Injectable } from '@nestjs/common';

import { ApplicationException } from '@/@core/application/exceptions/application-exception';
import { UseCase } from '@/@core/application/use-case';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';

import { ClinicRepository } from '@/modules/clinics/application/repositories/clinic.repository';
import { CommunicationAttemptsQueryRepository } from '@/modules/communications/application/repositories/communication-attempts-query.repository';

export type ListCommunicationAttemptsInput = {
	clinicId: string;
	limit?: number;
	offset?: number;
};

export type ListCommunicationAttemptsOutput = {
	items: Awaited<
		ReturnType<CommunicationAttemptsQueryRepository['findByClinicId']>
	>['items'];
	total: number;
	limit: number;
	offset: number;
};

@Injectable()
export class ListCommunicationAttemptsUseCase implements UseCase<
	ListCommunicationAttemptsInput,
	ListCommunicationAttemptsOutput
> {
	constructor(
		private readonly clinicRepository: ClinicRepository,
		private readonly communicationAttemptsQueryRepository: CommunicationAttemptsQueryRepository,
	) {}

	async exec(
		input: ListCommunicationAttemptsInput,
	): Promise<ListCommunicationAttemptsOutput> {
		const clinicId = EntityUuid.createFrom(input.clinicId);
		const limit = this.ensureValidLimit(input.limit);
		const offset = this.ensureValidOffset(input.offset);

		const clinic = await this.clinicRepository.findById(clinicId);
		if (!clinic) {
			throw new ApplicationException('CLINIC_NOT_FOUND');
		}

		const result =
			await this.communicationAttemptsQueryRepository.findByClinicId({
				clinicId,
				limit,
				offset,
			});

		return {
			...result,
			limit,
			offset,
		};
	}

	private ensureValidLimit(limit?: number): number {
		const resolvedLimit = limit ?? 50;
		if (
			!Number.isInteger(resolvedLimit) ||
			!Number.isSafeInteger(resolvedLimit) ||
			resolvedLimit <= 0
		) {
			throw new ApplicationException(
				'INVALID_COMMUNICATION_ATTEMPTS_PAGINATION',
			);
		}
		return resolvedLimit;
	}

	private ensureValidOffset(offset?: number): number {
		const resolvedOffset = offset ?? 0;
		if (
			!Number.isInteger(resolvedOffset) ||
			!Number.isSafeInteger(resolvedOffset) ||
			resolvedOffset < 0
		) {
			throw new ApplicationException(
				'INVALID_COMMUNICATION_ATTEMPTS_PAGINATION',
			);
		}
		return resolvedOffset;
	}
}
