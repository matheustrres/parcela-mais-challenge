import { describe, expect, it } from 'vitest';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { MoneyVo } from '@/@core/domain/entities/value-objects/money';
import { DomainException } from '@/@core/domain/exceptions/domain-exception';
import {
	ECommunicationChannel,
	ECommunicationType,
	EContactStatus,
	EInstallmentStatus,
} from '@/@core/enums/domain';

import { CollectionCommunicationMessageFactoryDomainService } from '@/modules/collections/domain/services/collections-communication-message-factory.service';
import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { PatientEntity } from '@/modules/patients/domain/entities/patient.entity';

describe('CollectionCommunicationMessageFactoryDomainService', () => {
	const service = new CollectionCommunicationMessageFactoryDomainService();

	const makePatient = (name = 'Ana') =>
		PatientEntity.create({
			name,
			clinicId: EntityUuid.createFrom('clinic-id'),
			email: 'ana@example.com',
			phone: '11999999999',
			preferredChannel: ECommunicationChannel.WhatsApp,
			contactStatus: EContactStatus.Active,
		});

	const makeInstallment = (
		overrides: Partial<{
			dueDate: Date;
			amount: MoneyVo;
			paidAmount: MoneyVo;
			status: EInstallmentStatus;
		}> = {},
	) =>
		InstallmentEntity.create({
			clinicId: EntityUuid.createFrom('clinic-id'),
			debtAgreementId: EntityUuid.createFrom('agreement-id'),
			installmentNumber: 1,
			dueDate: new Date('2026-05-28T12:00:00.000Z'),
			amount: MoneyVo.fromCents(50_000),
			paidAmount: MoneyVo.zero(),
			status: EInstallmentStatus.Pending,
			paidAt: null,
			version: 0,
			...overrides,
		});

	it('should create pre due whatsapp message with stable template key', () => {
		const patient = makePatient();
		const installment = makeInstallment();
		expect(
			service.createMessage({
				patient,
				installment,
				type: ECommunicationType.PreDueReminder,
				channel: ECommunicationChannel.WhatsApp,
				referenceDate: new Date('2026-05-25T13:00:00.000Z'),
			}),
		).toEqual({
			message:
				'Olá, Ana. Passando para lembrar que existe uma parcela com vencimento em 28/05/2026 no valor de R$ 500,00. Caso precise de apoio, entre em contato com a clínica.',
			templateKey: 'collection.pre_due_reminder.whatsapp.v1',
			aiGenerated: false,
		});
	});

	it('should create due date whatsapp message', () => {
		const patient = makePatient();
		const installment = makeInstallment();
		expect(
			service.createMessage({
				patient,
				installment,
				type: ECommunicationType.DueDateReminder,
				channel: ECommunicationChannel.WhatsApp,
				referenceDate: new Date('2026-05-28T13:00:00.000Z'),
			}),
		).toEqual({
			message:
				'Olá, Ana. Hoje vence uma parcela no valor de R$ 500,00, com vencimento em 28/05/2026. Caso já tenha realizado o pagamento, desconsidere esta mensagem.',
			templateKey: 'collection.due_date_reminder.whatsapp.v1',
			aiGenerated: false,
		});
	});

	it('should create overdue soft notice whatsapp message', () => {
		const patient = makePatient();
		const installment = makeInstallment();
		expect(
			service.createMessage({
				patient,
				installment,
				type: ECommunicationType.OverdueSoftNotice,
				channel: ECommunicationChannel.WhatsApp,
				referenceDate: new Date('2026-05-30T13:00:00.000Z'),
			}),
		).toEqual({
			message:
				'Olá, Ana. Identificamos uma parcela em aberto no valor de R$ 500,00, com vencimento em 28/05/2026. Caso já tenha realizado o pagamento, desconsidere esta mensagem. Se precisar de apoio, a clínica está disponível para ajudar.',
			templateKey: 'collection.overdue_soft_notice.whatsapp.v1',
			aiGenerated: false,
		});
	});

	it('should create overdue follow up whatsapp message', () => {
		const patient = makePatient();
		const installment = makeInstallment();
		expect(
			service.createMessage({
				patient,
				installment,
				type: ECommunicationType.OverdueFollowUp,
				channel: ECommunicationChannel.WhatsApp,
				referenceDate: new Date('2026-06-04T13:00:00.000Z'),
			}),
		).toEqual({
			message:
				'Olá, Ana. Consta uma parcela em aberto no valor de R$ 500,00, vencida em 28/05/2026. Para evitar acúmulo de pendências, recomendamos entrar em contato com a clínica.',
			templateKey: 'collection.overdue_follow_up.whatsapp.v1',
			aiGenerated: false,
		});
	});

	it('should create overdue follow up email message', () => {
		const patient = makePatient();
		const installment = makeInstallment();
		expect(
			service.createMessage({
				patient,
				installment,
				type: ECommunicationType.OverdueFollowUp,
				channel: ECommunicationChannel.Email,
				referenceDate: new Date('2026-06-04T13:00:00.000Z'),
			}),
		).toEqual({
			message:
				'Olá, Ana. Consta uma parcela em aberto no valor de R$ 500,00, com vencimento em 28/05/2026. Para evitar acúmulo de pendências, recomendamos entrar em contato com a clínica para verificar a regularização.',
			templateKey: 'collection.overdue_follow_up.email.v1',
			aiGenerated: false,
		});
	});

	it('should create overdue escalation email message', () => {
		const patient = makePatient();
		const installment = makeInstallment();
		expect(
			service.createMessage({
				patient,
				installment,
				type: ECommunicationType.OverdueEscalation,
				channel: ECommunicationChannel.Email,
				referenceDate: new Date('2026-06-12T13:00:00.000Z'),
			}),
		).toEqual({
			message:
				'Olá, Ana. Ainda identificamos uma parcela em aberto no valor de R$ 500,00, com vencimento em 28/05/2026, referente ao seu acordo financeiro com a clínica. Entre em contato para verificar as alternativas disponíveis de regularização.',
			templateKey: 'collection.overdue_escalation.email.v1',
			aiGenerated: false,
		});
	});

	it('should format due date as date-only for utc midnight dates', () => {
		const patient = makePatient();
		const installment = makeInstallment({
			dueDate: new Date('2026-06-10T00:00:00.000Z'),
		});
		expect(
			service.createMessage({
				patient,
				installment,
				type: ECommunicationType.DueDateReminder,
				channel: ECommunicationChannel.WhatsApp,
				referenceDate: new Date('2026-06-10T13:00:00.000Z'),
			}).message,
		).toContain('10/06/2026');
	});

	it('should use remaining amount in the rendered message', () => {
		const patient = makePatient();
		const installment = makeInstallment({
			amount: MoneyVo.fromCents(50_000),
			paidAmount: MoneyVo.fromCents(10_000),
			status: EInstallmentStatus.PartiallyPaid,
		});
		expect(
			service.createMessage({
				patient,
				installment,
				type: ECommunicationType.OverdueSoftNotice,
				channel: ECommunicationChannel.WhatsApp,
				referenceDate: new Date('2026-05-30T13:00:00.000Z'),
			}).message,
		).toContain('R$\u00a0400,00');
	});

	it('should reject payment confirmation until template exists', () => {
		const patient = makePatient();
		const installment = makeInstallment();
		expect(() =>
			service.createMessage({
				patient,
				installment,
				type: ECommunicationType.PaymentConfirmation,
				channel: ECommunicationChannel.Email,
				referenceDate: new Date('2026-05-28T13:00:00.000Z'),
			}),
		).toThrowError(
			new DomainException('UNSUPPORTED_COMMUNICATION_MESSAGE_TYPE'),
		);
	});

	it('should reject unsupported type and channel combination', () => {
		const patient = makePatient();
		const installment = makeInstallment();
		expect(() =>
			service.createMessage({
				patient,
				installment,
				type: ECommunicationType.PreDueReminder,
				channel: ECommunicationChannel.Email,
				referenceDate: new Date('2026-05-25T13:00:00.000Z'),
			}),
		).toThrowError(new DomainException('UNSUPPORTED_COMMUNICATION_TEMPLATE'));
	});

	it('should reject invalid reference date', () => {
		const patient = makePatient();
		const installment = makeInstallment();
		expect(() =>
			service.createMessage({
				patient,
				installment,
				type: ECommunicationType.PreDueReminder,
				channel: ECommunicationChannel.WhatsApp,
				referenceDate: new Date('invalid'),
			}),
		).toThrowError(
			new DomainException('COMMUNICATION_MESSAGE_REFERENCE_DATE_REQUIRED'),
		);
	});
});
