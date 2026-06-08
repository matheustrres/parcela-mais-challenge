import {
	buildCommunicationTemplateMapKey,
	COLLECTION_COMMUNICATION_MESSAGE_TEMPLATES,
	CommunicationMessageTemplateDefinition,
} from '../constants/collection-communication-message-templates';
import { CollectionCommunicationMessageFactoryOutput } from '../types/collection-communication-message-factory';

import { DomainException } from '@/@core/domain/exceptions/domain-exception';
import {
	ECommunicationChannel,
	ECommunicationType,
} from '@/@core/enums/domain';

import { InstallmentEntity } from '@/modules/installments/domain/entities/installment.entity';
import { PatientEntity } from '@/modules/patients/domain/entities/patient.entity';

import { ensureValidDate } from '@/shared/utils/ensure-valid-date';

type CommunicationMessageFactoryInput = {
	patient: PatientEntity;
	installment: InstallmentEntity;
	type: ECommunicationType;
	channel: ECommunicationChannel;
	referenceDate: Date;
};

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

export class CollectionCommunicationMessageFactoryDomainService {
	createMessage(
		input: CommunicationMessageFactoryInput,
	): CollectionCommunicationMessageFactoryOutput {
		ensureValidDate(
			input.referenceDate,
			'COMMUNICATION_MESSAGE_REFERENCE_DATE_REQUIRED',
		);

		if (input.type === ECommunicationType.PaymentConfirmation) {
			throw new DomainException('UNSUPPORTED_COMMUNICATION_MESSAGE_TYPE');
		}

		const template = this.resolveTemplate(input.type, input.channel);
		const value = input.installment.getRemainingAmount().format('pt-BR');
		const dueDate = this.formatDateOnlyPtBr(input.installment.dueDate);

		return {
			message: template.render({
				patientName: input.patient.name,
				value,
				dueDate,
			}),
			templateKey: template.key,
			aiGenerated: false,
		};
	}

	private resolveTemplate(
		type: ECommunicationType,
		channel: ECommunicationChannel,
	): CommunicationMessageTemplateDefinition {
		const templateKey = buildCommunicationTemplateMapKey(type, channel);
		const template = COLLECTION_COMMUNICATION_MESSAGE_TEMPLATES[templateKey];
		if (!template) {
			throw new DomainException('UNSUPPORTED_COMMUNICATION_TEMPLATE');
		}
		return template;
	}

	private formatDateOnlyPtBr(date: Date): string {
		const safeDate = new Date(
			Date.UTC(
				date.getUTCFullYear(),
				date.getUTCMonth(),
				date.getUTCDate(),
				12,
				0,
				0,
			),
		);

		return new Intl.DateTimeFormat('pt-BR', {
			timeZone: SAO_PAULO_TIME_ZONE,
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		}).format(safeDate);
	}
}
