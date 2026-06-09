import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import {
	ECommunicationChannel,
	ECommunicationStatus,
	ECommunicationType,
} from '@/@core/enums/domain';

import { CommunicationAttemptEntity } from '@/modules/communications/domain/entities/communication-attempt.entity';

type BuildCommunicationAttemptEntityOverrides = {
	id?: string;
	clinicId?: string;
	patientId?: string;
	installmentId?: string;
	type?: ECommunicationType;
	channel?: ECommunicationChannel;
	status?: ECommunicationStatus;
	scheduledFor?: Date | null;
	sentAt?: Date | null;
	skippedReason?: string | null;
	message?: string | null;
	aiGenerated?: boolean;
	templateKey?: string | null;
};

export function buildCommunicationAttemptEntity(
	overrides: BuildCommunicationAttemptEntityOverrides = {},
): CommunicationAttemptEntity {
	return CommunicationAttemptEntity.createFrom(
		EntityUuid.createFrom(overrides.id ?? 'communication-attempt-1'),
		{
			clinicId: EntityUuid.createFrom(overrides.clinicId ?? 'clinic-1'),
			patientId: EntityUuid.createFrom(overrides.patientId ?? 'patient-1'),
			installmentId: EntityUuid.createFrom(
				overrides.installmentId ?? 'installment-1',
			),
			type: overrides.type ?? ECommunicationType.DueDateReminder,
			channel: overrides.channel ?? ECommunicationChannel.WhatsApp,
			status: overrides.status ?? ECommunicationStatus.Generated,
			scheduledFor:
				overrides.scheduledFor ?? new Date('2026-01-10T12:00:00.000Z'),
			sentAt: overrides.sentAt ?? null,
			skippedReason: overrides.skippedReason ?? null,
			message: overrides.message ?? 'Mensagem',
			aiGenerated: overrides.aiGenerated ?? false,
			templateKey: overrides.templateKey ?? 'template-1',
		},
	);
}
