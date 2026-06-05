import { ECollectionPriorityScoreReason } from '../enums/collection-priority-score-reason';

import { CommunicationAttemptEntity } from '@/modules/communications/domain/entities/communication-attempt.entity';
import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { PaymentEntity } from '@/modules/payments/domain/entities/payment.entity';

export type CollectionPriorityScoreInput = {
	installments: InstallmentEntity[];
	communicationAttempts: CommunicationAttemptEntity[];
	payments: PaymentEntity[];
	referenceDate: Date;
};

export type CollectionPriorityScoreOutput = {
	score: number;
	reasons: ECollectionPriorityScoreReason[];
};
