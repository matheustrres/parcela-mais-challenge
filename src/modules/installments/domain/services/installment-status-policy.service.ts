import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { EDerivedInstallmentStatus } from '@/modules/installments/domain/enums/derived-status';

export class InstallmentStatusPolicyDomainService {
	deriveStatus(
		installment: InstallmentEntity,
		referenceDate: Date,
	): EDerivedInstallmentStatus {
		return installment.getDerivedStatus(referenceDate);
	}

	isOverdue(installment: InstallmentEntity, referenceDate: Date): boolean {
		return installment.isOverdue(referenceDate);
	}

	isDueToday(installment: InstallmentEntity, referenceDate: Date): boolean {
		return installment.isDueToday(referenceDate);
	}

	getDaysOverdue(installment: InstallmentEntity, referenceDate: Date): number {
		return installment.getDaysOverdue(referenceDate);
	}
}
