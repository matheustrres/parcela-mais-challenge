import {
	CreateEntityProps,
	EntityMeta,
	UpdatableEntity,
} from '@/@core/domain/entities/entity';
import { EntityId } from '@/@core/domain/entities/entity-id';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { DomainException } from '@/@core/domain/exceptions/domain-exception';
import { Guard } from '@/@core/domain/logic/guard';
import { ECommunicationChannel, EContactStatus } from '@/@core/enums/domain';

export class PatientEntity extends UpdatableEntity<PatientEntityProps> {
	private constructor(props: PatientEntityConstructor) {
		const normalizedProps = PatientEntity.normalizeProps(props.props);
		PatientEntity.validateProps(normalizedProps);
		super({
			...props,
			props: normalizedProps,
		});
	}

	static create(props: PatientEntityProps): PatientEntity {
		return new PatientEntity({
			id: EntityUuid.create(),
			props,
		});
	}

	static createFrom(
		id: EntityId,
		props: PatientEntityProps,
		meta?: EntityMeta,
	): PatientEntity {
		return new PatientEntity({
			id,
			props,
			meta,
		});
	}

	hasContactInfo(): boolean {
		return !!this.props.email || !!this.props.phone;
	}

	canBeContacted(): boolean {
		return (
			this.props.contactStatus === EContactStatus.Active &&
			this.hasContactInfo() &&
			this.props.preferredChannel !== null
		);
	}

	markAsDoNotContact(): void {
		this.props.contactStatus = EContactStatus.DoNotContact;
		this.touch();
	}

	markAsMissingContactInfo(): void {
		this.props.contactStatus = EContactStatus.MissingContactInfo;
		this.props.preferredChannel = null;
		this.touch();
	}

	changePreferredChannel(channel: ECommunicationChannel | null): void {
		PatientEntity.validatePreferredChannel({
			...this.props,
			preferredChannel: channel,
		});
		this.props.preferredChannel = channel;
		this.touch();
	}

	updateContactInfo(input: UpdatePatientContactInfoInput): void {
		const nextProps = PatientEntity.normalizeProps({
			...this.props,
			email: input.email === undefined ? this.props.email : input.email,
			phone: input.phone === undefined ? this.props.phone : input.phone,
			preferredChannel:
				input.preferredChannel === undefined
					? this.props.preferredChannel
					: input.preferredChannel,
		});
		PatientEntity.validateProps(nextProps);
		this.props = nextProps;
		this.touch();
	}

	get name(): string {
		return this.props.name;
	}

	get clinicId(): EntityId {
		return this.props.clinicId;
	}

	get email(): string | null {
		return this.props.email;
	}

	get phone(): string | null {
		return this.props.phone;
	}

	get preferredChannel(): ECommunicationChannel | null {
		return this.props.preferredChannel;
	}

	get contactStatus(): EContactStatus {
		return this.props.contactStatus;
	}

	private static normalizeProps(props: PatientEntityProps): PatientEntityProps {
		return {
			...props,
			name: props.name.trim(),
			email: props.email?.trim().toLowerCase() || null,
			phone: props.phone?.trim() || null,
		};
	}

	private static validateProps(props: PatientEntityProps): void {
		if (Guard.isEmpty(props.name) || props.name.trim().length === 0) {
			throw new DomainException('PATIENT_NAME_REQUIRED');
		}
		if (props.name.trim().length < 2) {
			throw new DomainException('PATIENT_NAME_TOO_SHORT');
		}
		if (props.name.trim().length > 120) {
			throw new DomainException('PATIENT_NAME_TOO_LONG');
		}
		if (Guard.isEmpty(props.clinicId)) {
			throw new DomainException('PATIENT_CLINIC_ID_REQUIRED');
		}
		this.validateEmail(props.email);
		this.validatePhone(props.phone);
		this.validatePreferredChannel(props);
	}

	private static validateEmail(email: string | null): void {
		if (email === null) return;
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			throw new DomainException('INVALID_PATIENT_EMAIL');
		}
	}

	private static validatePhone(phone: string | null): void {
		if (phone === null) return;
		if (phone.length < 8 || phone.length > 20) {
			throw new DomainException('INVALID_PATIENT_PHONE');
		}
	}

	private static validatePreferredChannel(props: PatientEntityProps): void {
		if (props.contactStatus === EContactStatus.DoNotContact) {
			return;
		}

		if (props.contactStatus === EContactStatus.MissingContactInfo) {
			if (props.preferredChannel !== null) {
				throw new DomainException(
					'MISSING_CONTACT_INFO_CANNOT_HAVE_PREFERRED_CHANNEL',
				);
			}
			return;
		}

		if (
			props.preferredChannel === ECommunicationChannel.WhatsApp &&
			!props.phone
		) {
			throw new DomainException('WHATSAPP_CHANNEL_REQUIRES_PHONE');
		}

		if (
			props.preferredChannel === ECommunicationChannel.Email &&
			!props.email
		) {
			throw new DomainException('EMAIL_CHANNEL_REQUIRES_EMAIL');
		}
	}
}

type PatientEntityProps = {
	name: string;
	clinicId: EntityId;
	email: string | null;
	phone: string | null;
	preferredChannel: ECommunicationChannel | null;
	contactStatus: EContactStatus;
};

type PatientEntityConstructor = CreateEntityProps<PatientEntityProps>;

type UpdatePatientContactInfoInput = {
	email?: string | null;
	phone?: string | null;
	preferredChannel?: ECommunicationChannel | null;
};
