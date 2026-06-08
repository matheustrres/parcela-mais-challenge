import {
	ECommunicationChannel,
	ECommunicationType,
} from '@/@core/enums/domain';

type CommunicationMessageTemplateRenderInput = {
	patientName: string;
	value: string;
	dueDate: string;
};

export type CommunicationMessageTemplateDefinition = {
	key: string;
	render(input: CommunicationMessageTemplateRenderInput): string;
};

export function buildCommunicationTemplateMapKey(
	type: ECommunicationType,
	channel: ECommunicationChannel,
): string {
	return `${type}.${channel}`;
}

export const COLLECTION_COMMUNICATION_MESSAGE_TEMPLATES: Record<
	string,
	CommunicationMessageTemplateDefinition
> = {
	[buildCommunicationTemplateMapKey(
		ECommunicationType.PreDueReminder,
		ECommunicationChannel.WhatsApp,
	)]: {
		key: 'collection.pre_due_reminder.whatsapp.v1',
		render: (input) =>
			`Olá, ${input.patientName}. Passando para lembrar que existe uma parcela com vencimento em ${input.dueDate} no valor de ${input.value}. Caso precise de apoio, entre em contato com a clínica.`,
	},
	[buildCommunicationTemplateMapKey(
		ECommunicationType.DueDateReminder,
		ECommunicationChannel.WhatsApp,
	)]: {
		key: 'collection.due_date_reminder.whatsapp.v1',
		render: (input) =>
			`Olá, ${input.patientName}. Hoje vence uma parcela no valor de ${input.value}, com vencimento em ${input.dueDate}. Caso já tenha realizado o pagamento, desconsidere esta mensagem.`,
	},
	[buildCommunicationTemplateMapKey(
		ECommunicationType.OverdueSoftNotice,
		ECommunicationChannel.WhatsApp,
	)]: {
		key: 'collection.overdue_soft_notice.whatsapp.v1',
		render: (input) =>
			`Olá, ${input.patientName}. Identificamos uma parcela em aberto no valor de ${input.value}, com vencimento em ${input.dueDate}. Caso já tenha realizado o pagamento, desconsidere esta mensagem. Se precisar de apoio, a clínica está disponível para ajudar.`,
	},
	[buildCommunicationTemplateMapKey(
		ECommunicationType.OverdueFollowUp,
		ECommunicationChannel.WhatsApp,
	)]: {
		key: 'collection.overdue_follow_up.whatsapp.v1',
		render: (input) =>
			`Olá, ${input.patientName}. Consta uma parcela em aberto no valor de ${input.value}, vencida em ${input.dueDate}. Para evitar acúmulo de pendências, recomendamos entrar em contato com a clínica.`,
	},
	[buildCommunicationTemplateMapKey(
		ECommunicationType.OverdueFollowUp,
		ECommunicationChannel.Email,
	)]: {
		key: 'collection.overdue_follow_up.email.v1',
		render: (input) =>
			`Olá, ${input.patientName}. Consta uma parcela em aberto no valor de ${input.value}, com vencimento em ${input.dueDate}. Para evitar acúmulo de pendências, recomendamos entrar em contato com a clínica para verificar a regularização.`,
	},
	[buildCommunicationTemplateMapKey(
		ECommunicationType.OverdueEscalation,
		ECommunicationChannel.Email,
	)]: {
		key: 'collection.overdue_escalation.email.v1',
		render: (input) =>
			`Olá, ${input.patientName}. Ainda identificamos uma parcela em aberto no valor de ${input.value}, com vencimento em ${input.dueDate}, referente ao seu acordo financeiro com a clínica. Entre em contato para verificar as alternativas disponíveis de regularização.`,
	},
};
