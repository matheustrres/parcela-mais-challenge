export enum ContactStatus {
	Active = 'ACTIVE',
	DoNotContact = 'DO_NOT_CONTACT',
	MissingContactInfo = 'MISSING_CONTACT_INFO',
}

export enum DebtAgreementStatus {
	Active = 'ACTIVE',
	Paid = 'PAID',
	Canceled = 'CANCELED',
}

// Persisted installment status.
// DUE_TODAY and OVERDUE should be derived from dueDate + amount/paid balance.
export enum InstallmentStatus {
	Pending = 'PENDING',
	PartiallyPaid = 'PARTIALLY_PAID',
	Paid = 'PAID',
	Canceled = 'CANCELED',
}

export enum PaymentMethod {
	Pix = 'PIX',
	Boleto = 'BOLETO',
	Manual = 'MANUAL',
	WebhookSimulated = 'WEBHOOK_SIMULATED',
}

export enum CommunicationType {
	PreDueReminder = 'PRE_DUE_REMINDER',
	DueDateReminder = 'DUE_DATE_REMINDER',
	OverdueSoftNotice = 'OVERDUE_SOFT_NOTICE',
	OverdueFollowUp = 'OVERDUE_FOLLOW_UP',
	OverdueEscalation = 'OVERDUE_ESCALATION',
	PaymentConfirmation = 'PAYMENT_CONFIRMATION',
}

export enum CommunicationChannel {
	WhatsApp = 'WHATSAPP',
	Email = 'EMAIL',
}

export enum CommunicationStatus {
	Pending = 'PENDING',
	Generated = 'GENERATED',
	SentSimulated = 'SENT_SIMULATED',
	Skipped = 'SKIPPED',
	Failed = 'FAILED',
}

export enum PaymentWebhookStatus {
	Received = 'RECEIVED',
	Processed = 'PROCESSED',
	Duplicated = 'DUPLICATED',
	Failed = 'FAILED',
}
