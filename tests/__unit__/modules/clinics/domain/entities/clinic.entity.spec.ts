import { describe, expect, it, vi } from 'vitest';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { DomainException } from '@/@core/domain/exceptions/domain-exception';

import { ClinicEntity } from '@/modules/clinics/domain/entities/clinic.entity';

describe('ClinicEntity', () => {
	const makeProps = () => ({
		name: 'Clinica Central',
	});

	describe('.create', () => {
		it('should create clinic with normalized name and generated id', () => {
			const clinic = ClinicEntity.create({
				name: '  Clinica Central  ',
			});
			expect(clinic.id).toBeInstanceOf(EntityUuid);
			expect(clinic.name).toBe('Clinica Central');
			expect(clinic.createdAt).toBeInstanceOf(Date);
			expect(clinic.updatedAt).toBeNull();
		});

		it('should reject empty clinic name', () => {
			expect(() =>
				ClinicEntity.create({
					name: ' ',
				}),
			).toThrowError(new DomainException('CLINIC_NAME_REQUIRED'));
		});

		it('should reject short clinic name', () => {
			expect(() =>
				ClinicEntity.create({
					name: 'A',
				}),
			).toThrowError(new DomainException('CLINIC_NAME_TOO_SHORT'));
		});

		it('should reject long clinic name', () => {
			expect(() =>
				ClinicEntity.create({
					name: 'a'.repeat(121),
				}),
			).toThrowError(new DomainException('CLINIC_NAME_TOO_LONG'));
		});
	});

	describe('.createFrom', () => {
		it('should create clinic with provided id and meta', () => {
			const id = EntityUuid.createFrom('clinic-id');
			const createdAt = new Date('2024-02-01T10:00:00.000Z');
			const updatedAt = new Date('2024-02-02T10:00:00.000Z');
			const clinic = ClinicEntity.createFrom(
				id,
				{
					name: '  Clinica Central  ',
				},
				{ createdAt, updatedAt },
			);
			expect(clinic.id.toString()).toBe('clinic-id');
			expect(clinic.name).toBe('Clinica Central');
			expect(clinic.createdAt).toBe(createdAt);
			expect(clinic.updatedAt).toBe(updatedAt);
		});
	});

	describe('.changeName', () => {
		it('should change clinic name trimming input and touch updatedAt', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2024-02-03T10:00:00.000Z'));
			const clinic = ClinicEntity.create(makeProps());
			clinic.changeName('  Clinica Renomeada  ');
			expect(clinic.name).toBe('Clinica Renomeada');
			expect(clinic.updatedAt).toEqual(new Date('2024-02-03T10:00:00.000Z'));
			vi.useRealTimers();
		});

		it('should reject empty clinic name', () => {
			const clinic = ClinicEntity.create(makeProps());
			expect(() => clinic.changeName(' ')).toThrowError(
				new DomainException('CLINIC_NAME_REQUIRED'),
			);
		});

		it('should reject short clinic name', () => {
			const clinic = ClinicEntity.create(makeProps());
			expect(() => clinic.changeName('A')).toThrowError(
				new DomainException('CLINIC_NAME_TOO_SHORT'),
			);
		});

		it('should reject long clinic name', () => {
			const clinic = ClinicEntity.create(makeProps());
			expect(() => clinic.changeName('a'.repeat(121))).toThrowError(
				new DomainException('CLINIC_NAME_TOO_LONG'),
			);
		});
	});

	describe('.name', () => {
		it('should return clinic name', () => {
			expect(ClinicEntity.create(makeProps()).name).toBe('Clinica Central');
		});
	});
});
