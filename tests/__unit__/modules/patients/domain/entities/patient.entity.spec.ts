import { describe, expect, it, vi } from 'vitest';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { DomainException } from '@/@core/domain/exceptions/domain-exception';
import { ECommunicationChannel, EContactStatus } from '@/@core/enums/domain';

import { PatientEntity } from '@/modules/patients/domain/entities/patient.entity';

describe('PatientEntity', () => {
	const makeClinicId = () => EntityUuid.createFrom('clinic-id');

	const makeProps = () => ({
		name: 'Maria Silva',
		clinicId: makeClinicId(),
		email: 'maria@example.com',
		phone: '11999999999',
		preferredChannel: ECommunicationChannel.WhatsApp,
		contactStatus: EContactStatus.Active,
	});

	describe('.create', () => {
		it('should create patient with normalized props and generated id', () => {
			const patient = PatientEntity.create({
				...makeProps(),
				name: '  Maria Silva  ',
				email: '  MARIA@EXAMPLE.COM  ',
				phone: ' 11999999999 ',
			});
			expect(patient.id).toBeInstanceOf(EntityUuid);
			expect(patient.name).toBe('Maria Silva');
			expect(patient.email).toBe('maria@example.com');
			expect(patient.phone).toBe('11999999999');
			expect(patient.preferredChannel).toBe(ECommunicationChannel.WhatsApp);
			expect(patient.contactStatus).toBe(EContactStatus.Active);
			expect(patient.createdAt).toBeInstanceOf(Date);
			expect(patient.updatedAt).toBeNull();
		});

		it('should reject empty patient name', () => {
			expect(() =>
				PatientEntity.create({
					...makeProps(),
					name: ' ',
				}),
			).toThrowError(new DomainException('PATIENT_NAME_REQUIRED'));
		});

		it('should reject short patient name', () => {
			expect(() =>
				PatientEntity.create({
					...makeProps(),
					name: 'A',
				}),
			).toThrowError(new DomainException('PATIENT_NAME_TOO_SHORT'));
		});

		it('should reject long patient name', () => {
			expect(() =>
				PatientEntity.create({
					...makeProps(),
					name: 'a'.repeat(121),
				}),
			).toThrowError(new DomainException('PATIENT_NAME_TOO_LONG'));
		});

		it('should reject missing clinic id', () => {
			expect(() =>
				PatientEntity.create({
					...makeProps(),
					clinicId: null as never,
				}),
			).toThrowError(new DomainException('PATIENT_CLINIC_ID_REQUIRED'));
		});

		it('should reject invalid email', () => {
			expect(() =>
				PatientEntity.create({
					...makeProps(),
					email: 'invalid-email',
				}),
			).toThrowError(new DomainException('INVALID_PATIENT_EMAIL'));
		});

		it('should reject invalid phone', () => {
			expect(() =>
				PatientEntity.create({
					...makeProps(),
					phone: '1234567',
				}),
			).toThrowError(new DomainException('INVALID_PATIENT_PHONE'));
		});

		it('should reject whatsapp preferred channel without phone', () => {
			expect(() =>
				PatientEntity.create({
					...makeProps(),
					phone: null,
					preferredChannel: ECommunicationChannel.WhatsApp,
				}),
			).toThrowError(new DomainException('WHATSAPP_CHANNEL_REQUIRES_PHONE'));
		});

		it('should reject email preferred channel without email', () => {
			expect(() =>
				PatientEntity.create({
					...makeProps(),
					email: null,
					preferredChannel: ECommunicationChannel.Email,
				}),
			).toThrowError(new DomainException('EMAIL_CHANNEL_REQUIRES_EMAIL'));
		});

		it('should reject preferred channel when contact status is missing contact info', () => {
			expect(() =>
				PatientEntity.create({
					...makeProps(),
					phone: null,
					email: null,
					preferredChannel: ECommunicationChannel.Email,
					contactStatus: EContactStatus.MissingContactInfo,
				}),
			).toThrowError(
				new DomainException(
					'MISSING_CONTACT_INFO_CANNOT_HAVE_PREFERRED_CHANNEL',
				),
			);
		});
	});

	describe('.createFrom', () => {
		it('should create patient with provided id and meta', () => {
			const id = EntityUuid.createFrom('patient-id');
			const createdAt = new Date('2024-01-01T10:00:00.000Z');
			const updatedAt = new Date('2024-01-02T10:00:00.000Z');
			const patient = PatientEntity.createFrom(
				id,
				{
					...makeProps(),
					email: '  MARIA@EXAMPLE.COM  ',
				},
				{ createdAt, updatedAt },
			);
			expect(patient.id.toString()).toBe('patient-id');
			expect(patient.createdAt).toBe(createdAt);
			expect(patient.updatedAt).toBe(updatedAt);
			expect(patient.email).toBe('maria@example.com');
		});
	});

	describe('.hasContactInfo', () => {
		it('should return true when patient has email', () => {
			const patient = PatientEntity.create({
				...makeProps(),
				phone: null,
			});
			expect(patient.hasContactInfo()).toBe(true);
		});

		it('should return true when patient has phone', () => {
			const patient = PatientEntity.create({
				...makeProps(),
				email: null,
			});
			expect(patient.hasContactInfo()).toBe(true);
		});

		it('should return false when patient has no email and no phone', () => {
			const patient = PatientEntity.create({
				...makeProps(),
				email: null,
				phone: null,
				preferredChannel: null,
				contactStatus: EContactStatus.DoNotContact,
			});
			expect(patient.hasContactInfo()).toBe(false);
		});
	});

	describe('.canBeContacted', () => {
		it('should return true when patient is active and has contact info and preferred channel', () => {
			expect(PatientEntity.create(makeProps()).canBeContacted()).toBe(true);
		});

		it('should return false when patient is not active', () => {
			const patient = PatientEntity.create({
				...makeProps(),
				contactStatus: EContactStatus.DoNotContact,
			});
			expect(patient.canBeContacted()).toBe(false);
		});

		it('should return false when patient has no preferred channel', () => {
			const patient = PatientEntity.create({
				...makeProps(),
				preferredChannel: null,
			});
			expect(patient.canBeContacted()).toBe(false);
		});

		it('should return false when patient has no contact info', () => {
			const patient = PatientEntity.create({
				...makeProps(),
				email: null,
				phone: null,
				preferredChannel: null,
				contactStatus: EContactStatus.DoNotContact,
			});
			expect(patient.canBeContacted()).toBe(false);
		});
	});

	describe('.markAsDoNotContact', () => {
		it('should update contact status and touch updatedAt', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2024-01-03T10:00:00.000Z'));
			const patient = PatientEntity.create(makeProps());
			patient.markAsDoNotContact();
			expect(patient.contactStatus).toBe(EContactStatus.DoNotContact);
			expect(patient.updatedAt).toEqual(new Date('2024-01-03T10:00:00.000Z'));

			vi.useRealTimers();
		});
	});

	describe('.markAsMissingContactInfo', () => {
		it('should update status clear preferred channel and touch updatedAt', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2024-01-04T10:00:00.000Z'));
			const patient = PatientEntity.create(makeProps());
			patient.markAsMissingContactInfo();
			expect(patient.contactStatus).toBe(EContactStatus.MissingContactInfo);
			expect(patient.preferredChannel).toBeNull();
			expect(patient.updatedAt).toEqual(new Date('2024-01-04T10:00:00.000Z'));

			vi.useRealTimers();
		});
	});

	describe('.changePreferredChannel', () => {
		it('should change preferred channel and touch updatedAt', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2024-01-05T10:00:00.000Z'));
			const patient = PatientEntity.create({
				...makeProps(),
				preferredChannel: ECommunicationChannel.WhatsApp,
			});
			patient.changePreferredChannel(ECommunicationChannel.Email);
			expect(patient.preferredChannel).toBe(ECommunicationChannel.Email);
			expect(patient.updatedAt).toEqual(new Date('2024-01-05T10:00:00.000Z'));
			vi.useRealTimers();
		});

		it('should allow null preferred channel', () => {
			const patient = PatientEntity.create(makeProps());
			patient.changePreferredChannel(null);
			expect(patient.preferredChannel).toBeNull();
		});

		it('should reject whatsapp channel without phone', () => {
			const patient = PatientEntity.create({
				...makeProps(),
				phone: null,
				preferredChannel: null,
			});
			expect(() =>
				patient.changePreferredChannel(ECommunicationChannel.WhatsApp),
			).toThrowError(new DomainException('WHATSAPP_CHANNEL_REQUIRES_PHONE'));
		});

		it('should reject email channel without email', () => {
			const patient = PatientEntity.create({
				...makeProps(),
				email: null,
				preferredChannel: ECommunicationChannel.WhatsApp,
			});
			expect(() =>
				patient.changePreferredChannel(ECommunicationChannel.Email),
			).toThrowError(new DomainException('EMAIL_CHANNEL_REQUIRES_EMAIL'));
		});
	});

	describe('.updateContactInfo', () => {
		it('should update and normalize contact fields preserving unspecified values', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2024-01-06T10:00:00.000Z'));
			const patient = PatientEntity.create(makeProps());
			patient.updateContactInfo({
				email: '  NOVO@EXAMPLE.COM  ',
			});
			expect(patient.email).toBe('novo@example.com');
			expect(patient.phone).toBe('11999999999');
			expect(patient.preferredChannel).toBe(ECommunicationChannel.WhatsApp);
			expect(patient.updatedAt).toEqual(new Date('2024-01-06T10:00:00.000Z'));
			vi.useRealTimers();
		});

		it('should update phone and preferred channel', () => {
			const patient = PatientEntity.create({
				...makeProps(),
				preferredChannel: ECommunicationChannel.Email,
			});
			patient.updateContactInfo({
				phone: ' 11888888888 ',
				preferredChannel: ECommunicationChannel.WhatsApp,
			});
			expect(patient.phone).toBe('11888888888');
			expect(patient.preferredChannel).toBe(ECommunicationChannel.WhatsApp);
		});

		it('should reject invalid email', () => {
			const patient = PatientEntity.create(makeProps());
			expect(() =>
				patient.updateContactInfo({
					email: 'invalid',
				}),
			).toThrowError(new DomainException('INVALID_PATIENT_EMAIL'));
		});

		it('should reject invalid phone', () => {
			const patient = PatientEntity.create(makeProps());
			expect(() =>
				patient.updateContactInfo({
					phone: '1234567',
				}),
			).toThrowError(new DomainException('INVALID_PATIENT_PHONE'));
		});

		it('should reject whatsapp channel without phone after update', () => {
			const patient = PatientEntity.create(makeProps());
			expect(() =>
				patient.updateContactInfo({
					phone: null,
					preferredChannel: ECommunicationChannel.WhatsApp,
				}),
			).toThrowError(new DomainException('WHATSAPP_CHANNEL_REQUIRES_PHONE'));
		});

		it('should reject email channel without email after update', () => {
			const patient = PatientEntity.create({
				...makeProps(),
				preferredChannel: ECommunicationChannel.WhatsApp,
			});
			expect(() =>
				patient.updateContactInfo({
					email: null,
					preferredChannel: ECommunicationChannel.Email,
				}),
			).toThrowError(new DomainException('EMAIL_CHANNEL_REQUIRES_EMAIL'));
		});
	});

	describe('.name', () => {
		it('should return patient name', () => {
			expect(PatientEntity.create(makeProps()).name).toBe('Maria Silva');
		});
	});

	describe('.clinicId', () => {
		it('should return clinic id', () => {
			expect(PatientEntity.create(makeProps()).clinicId.toString()).toBe(
				'clinic-id',
			);
		});
	});

	describe('.email', () => {
		it('should return patient email', () => {
			expect(PatientEntity.create(makeProps()).email).toBe('maria@example.com');
		});
	});

	describe('.phone', () => {
		it('should return patient phone', () => {
			expect(PatientEntity.create(makeProps()).phone).toBe('11999999999');
		});
	});

	describe('.preferredChannel', () => {
		it('should return patient preferred channel', () => {
			expect(PatientEntity.create(makeProps()).preferredChannel).toBe(
				ECommunicationChannel.WhatsApp,
			);
		});
	});

	describe('.contactStatus', () => {
		it('should return patient contact status', () => {
			expect(PatientEntity.create(makeProps()).contactStatus).toBe(
				EContactStatus.Active,
			);
		});
	});
});
