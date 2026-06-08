import { DomainException } from '@/@core/domain/exceptions/domain-exception';

import { ensureValidDate } from '@/shared/utils/ensure-valid-date';

type GenerateDueDatesInput = {
	firstDueDate: Date;
	installmentsCount: number;
};

export class InstallmentSchedulePolicyDomainService {
	generateDueDates(input: GenerateDueDatesInput): Date[] {
		ensureValidDate(
			input.firstDueDate,
			'INSTALLMENT_SCHEDULE_FIRST_DUE_DATE_REQUIRED',
		);

		if (
			!Number.isInteger(input.installmentsCount) ||
			input.installmentsCount <= 0
		) {
			throw new DomainException(
				'INSTALLMENT_SCHEDULE_COUNT_MUST_BE_POSITIVE_INTEGER',
			);
		}

		const anchorYear = input.firstDueDate.getFullYear();
		const anchorMonth = input.firstDueDate.getMonth();
		const anchorDay = input.firstDueDate.getDate();
		const anchorHours = input.firstDueDate.getHours();
		const anchorMinutes = input.firstDueDate.getMinutes();
		const anchorSeconds = input.firstDueDate.getSeconds();
		const anchorMilliseconds = input.firstDueDate.getMilliseconds();

		return Array.from({ length: input.installmentsCount }, (_, index) => {
			const monthOffset = anchorMonth + index;
			const year = anchorYear + Math.floor(monthOffset / 12);
			const month = monthOffset % 12;
			const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
			const day = Math.min(anchorDay, lastDayOfMonth);

			return new Date(
				year,
				month,
				day,
				anchorHours,
				anchorMinutes,
				anchorSeconds,
				anchorMilliseconds,
			);
		});
	}
}
