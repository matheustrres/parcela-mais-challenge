import {
	CreateEntityProps,
	EntityMeta,
	UpdatableEntity,
} from '@/@core/domain/entities/entity';
import { EntityId } from '@/@core/domain/entities/entity-id';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { DomainException } from '@/@core/domain/exceptions/domain-exception';
import { Guard } from '@/@core/domain/logic/guard';
import {
	ECommunicationChannel,
	ECommunicationStatus,
	ECommunicationType,
} from '@/@core/enums/domain';

import { ensureValidDate } from '@/shared/utils/ensure-valid-date';

type CommunicationAttemptEntityProps = {
	clinicId: EntityId;
	patientId: EntityId;
	installmentId: EntityId;
	type: ECommunicationType;
	channel: ECommunicationChannel;
	status: ECommunicationStatus;
	scheduledFor: Date | null;
	sentAt: Date | null;
	skippedReason: string | null;
	message: string | null;
	aiGenerated: boolean;
	templateKey: string | null;
};

type CommunicationAttemptEntityConstructor =
	CreateEntityProps<CommunicationAttemptEntityProps>;

export class CommunicationAttemptEntity extends UpdatableEntity<CommunicationAttemptEntityProps> {
	private constructor(props: CommunicationAttemptEntityConstructor) {
		const normalizedProps = CommunicationAttemptEntity.normalizeProps(
			props.props,
		);
		CommunicationAttemptEntity.validateProps(normalizedProps);
		super({
			...props,
			props: normalizedProps,
		});
	}

	static create(
		props: CommunicationAttemptEntityProps,
	): CommunicationAttemptEntity {
		return new CommunicationAttemptEntity({
			id: EntityUuid.create(),
			props,
		});
	}

	static createFrom(
		id: EntityId,
		props: CommunicationAttemptEntityProps,
		meta?: EntityMeta,
	): CommunicationAttemptEntity {
		return new CommunicationAttemptEntity({
			id,
			props,
			meta,
		});
	}

	markAsSent(sentAt: Date): void {
		ensureValidDate(sentAt, 'COMMUNICATION_SENT_AT_REQUIRED');
		this.props.status = ECommunicationStatus.SentSimulated;
		this.props.sentAt = sentAt;
		this.props.skippedReason = null;
		this.touch();
	}

	markAsSkipped(reason: string): void {
		const normalizedReason = reason.trim();
		if (!normalizedReason.length) {
			throw new DomainException('COMMUNICATION_SKIP_REASON_REQUIRED');
		}
		this.props.status = ECommunicationStatus.Skipped;
		this.props.skippedReason = normalizedReason;
		this.props.sentAt = null;
		this.touch();
	}

	markAsFailed(reason: string): void {
		const normalizedReason = reason.trim();
		if (!normalizedReason.length) {
			throw new DomainException('COMMUNICATION_FAILURE_REASON_REQUIRED');
		}
		this.props.status = ECommunicationStatus.Failed;
		this.props.skippedReason = normalizedReason;
		this.props.sentAt = null;
		this.touch();
	}

	hasBeenSent(): boolean {
		return this.props.sentAt !== null;
	}

	get clinicId(): EntityId {
		return this.props.clinicId;
	}

	get patientId(): EntityId {
		return this.props.patientId;
	}

	get installmentId(): EntityId {
		return this.props.installmentId;
	}

	get type(): ECommunicationType {
		return this.props.type;
	}

	get channel(): ECommunicationChannel {
		return this.props.channel;
	}

	get status(): ECommunicationStatus {
		return this.props.status;
	}

	get scheduledFor(): Date | null {
		return this.props.scheduledFor;
	}

	get sentAt(): Date | null {
		return this.props.sentAt;
	}

	get skippedReason(): string | null {
		return this.props.skippedReason;
	}

	get message(): string | null {
		return this.props.message;
	}

	get aiGenerated(): boolean {
		return this.props.aiGenerated;
	}

	get templateKey(): string | null {
		return this.props.templateKey;
	}

	private static normalizeProps(
		props: CommunicationAttemptEntityProps,
	): CommunicationAttemptEntityProps {
		return {
			...props,
			skippedReason: props.skippedReason?.trim() || null,
			message: props.message?.trim() || null,
			templateKey: props.templateKey?.trim() || null,
		};
	}

	private static validateProps(props: CommunicationAttemptEntityProps): void {
		if (Guard.isEmpty(props.clinicId)) {
			throw new DomainException('COMMUNICATION_CLINIC_ID_REQUIRED');
		}
		if (Guard.isEmpty(props.patientId)) {
			throw new DomainException('COMMUNICATION_PATIENT_ID_REQUIRED');
		}
		if (Guard.isEmpty(props.installmentId)) {
			throw new DomainException('COMMUNICATION_INSTALLMENT_ID_REQUIRED');
		}
		if (!Object.values(ECommunicationType).includes(props.type)) {
			throw new DomainException('INVALID_COMMUNICATION_TYPE');
		}
		if (!Object.values(ECommunicationChannel).includes(props.channel)) {
			throw new DomainException('INVALID_COMMUNICATION_CHANNEL');
		}
		if (!Object.values(ECommunicationStatus).includes(props.status)) {
			throw new DomainException('INVALID_COMMUNICATION_STATUS');
		}
		if (props.scheduledFor !== null) {
			ensureValidDate(
				props.scheduledFor,
				'COMMUNICATION_SCHEDULED_FOR_MUST_BE_VALID_DATE',
			);
		}
		if (props.sentAt !== null) {
			ensureValidDate(props.sentAt, 'COMMUNICATION_SENT_AT_MUST_BE_VALID_DATE');
		}
		if (props.status === ECommunicationStatus.Skipped && !props.skippedReason) {
			throw new DomainException('SKIPPED_COMMUNICATION_REQUIRES_REASON');
		}
		if (props.status === ECommunicationStatus.Failed && !props.skippedReason) {
			throw new DomainException('FAILED_COMMUNICATION_REQUIRES_REASON');
		}
		if (
			props.status === ECommunicationStatus.SentSimulated &&
			props.sentAt === null
		) {
			throw new DomainException('SENT_COMMUNICATION_REQUIRES_SENT_AT');
		}
	}
}
