import { EntityId } from '@/@core/domain/entities/entity-id';
import {
	ECommunicationChannel,
	ECommunicationStatus,
	ECommunicationType,
	EInstallmentStatus,
} from '@/@core/enums/domain';

export type CommunicationAttemptListItem = {
	id: string;
	patientId: string;
	installmentId: string;
	type: ECommunicationType;
	channel: ECommunicationChannel;
	status: ECommunicationStatus;
	scheduledFor: Date | null;
	sentAt: Date | null;
	skippedReason: string | null;
	templateKey: string | null;
	aiGenerated: boolean;
	message: string | null;
	createdAt: Date;
	patient: {
		id: string;
		name: string;
	};
	installment: {
		id: string;
		installmentNumber: number;
		dueDate: Date;
		status: EInstallmentStatus;
	};
};

export type PaginatedCommunicationAttempts = {
	items: CommunicationAttemptListItem[];
	total: number;
};

export abstract class CommunicationAttemptsQueryRepository {
	abstract findByClinicId(input: {
		clinicId: EntityId;
		limit: number;
		offset: number;
	}): Promise<PaginatedCommunicationAttempts>;
}
