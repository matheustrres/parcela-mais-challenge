import { describe, expect, it, vi } from 'vitest';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { DomainException } from '@/@core/domain/exceptions/domain-exception';
import {
	ECommunicationChannel,
	ECommunicationStatus,
	ECommunicationType,
} from '@/@core/enums/domain';

import { CommunicationAttemptEntity } from '@/modules/communications/domain/entities/communication-attempt.entity';

describe('CommunicationAttemptEntity', () => {
	const makeProps = () => ({
		clinicId: EntityUuid.createFrom('clinic-id'),
		patientId: EntityUuid.createFrom('patient-id'),
		installmentId: EntityUuid.createFrom('installment-id'),
		type: ECommunicationType.DueDateReminder,
		channel: ECommunicationChannel.WhatsApp,
		status: ECommunicationStatus.Pending,
		scheduledFor: new Date('2024-06-01T10:00:00.000Z'),
		sentAt: null,
		skippedReason: null,
		message: '  lembrete  ',
		aiGenerated: true,
		templateKey: ' reminder ',
	});

	describe('.create', () => {
		it('should create communication attempt with normalized optional fields', () => {
			const entity = CommunicationAttemptEntity.create(makeProps());
			expect(entity.id).toBeInstanceOf(EntityUuid);
			expect(entity.message).toBe('lembrete');
			expect(entity.templateKey).toBe('reminder');
			expect(entity.status).toBe(ECommunicationStatus.Pending);
		});

		it('should reject missing clinic id', () => {
			expect(() =>
				CommunicationAttemptEntity.create({
					...makeProps(),
					clinicId: null as never,
				}),
			).toThrowError(new DomainException('COMMUNICATION_CLINIC_ID_REQUIRED'));
		});

		it('should reject skipped status without reason', () => {
			expect(() =>
				CommunicationAttemptEntity.create({
					...makeProps(),
					status: ECommunicationStatus.Skipped,
				}),
			).toThrowError(
				new DomainException('SKIPPED_COMMUNICATION_REQUIRES_REASON'),
			);
		});

		it('should reject sent status without sentAt', () => {
			expect(() =>
				CommunicationAttemptEntity.create({
					...makeProps(),
					status: ECommunicationStatus.SentSimulated,
				}),
			).toThrowError(
				new DomainException('SENT_COMMUNICATION_REQUIRES_SENT_AT'),
			);
		});
	});

	describe('.markAsSent', () => {
		it('should mark attempt as sent and touch updatedAt', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2024-06-02T10:00:00.000Z'));
			const entity = CommunicationAttemptEntity.create(makeProps());
			const sentAt = new Date('2024-06-02T09:00:00.000Z');
			entity.markAsSent(sentAt);
			expect(entity.status).toBe(ECommunicationStatus.SentSimulated);
			expect(entity.sentAt).toEqual(sentAt);
			expect(entity.skippedReason).toBeNull();
			expect(entity.updatedAt).toEqual(new Date('2024-06-02T10:00:00.000Z'));
			vi.useRealTimers();
		});
	});

	describe('.markAsSkipped', () => {
		it('should mark attempt as skipped store trimmed reason and touch updatedAt', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2024-06-03T10:00:00.000Z'));
			const entity = CommunicationAttemptEntity.create(makeProps());
			entity.markAsSkipped('  sem opt-in  ');
			expect(entity.status).toBe(ECommunicationStatus.Skipped);
			expect(entity.skippedReason).toBe('sem opt-in');
			expect(entity.sentAt).toBeNull();
			expect(entity.updatedAt).toEqual(new Date('2024-06-03T10:00:00.000Z'));
			vi.useRealTimers();
		});

		it('should reject empty skip reason', () => {
			const entity = CommunicationAttemptEntity.create(makeProps());
			expect(() => entity.markAsSkipped(' ')).toThrowError(
				new DomainException('COMMUNICATION_SKIP_REASON_REQUIRED'),
			);
		});
	});

	describe('.markAsFailed', () => {
		it('should mark attempt as failed store trimmed reason and touch updatedAt', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2024-06-04T10:00:00.000Z'));
			const entity = CommunicationAttemptEntity.create(makeProps());
			entity.markAsFailed('  provider timeout  ');
			expect(entity.status).toBe(ECommunicationStatus.Failed);
			expect(entity.skippedReason).toBe('provider timeout');
			expect(entity.updatedAt).toEqual(new Date('2024-06-04T10:00:00.000Z'));
			vi.useRealTimers();
		});
	});

	describe('.hasBeenSent', () => {
		it('should return true when sentAt exists', () => {
			expect(
				CommunicationAttemptEntity.create({
					...makeProps(),
					status: ECommunicationStatus.SentSimulated,
					sentAt: new Date('2024-06-02T09:00:00.000Z'),
				}).hasBeenSent(),
			).toBe(true);
		});

		it('should return false when sentAt is null', () => {
			expect(CommunicationAttemptEntity.create(makeProps()).hasBeenSent()).toBe(
				false,
			);
		});
	});
});
