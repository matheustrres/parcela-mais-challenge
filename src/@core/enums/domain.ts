export enum EContactStatus {
	Active = 'ACTIVE',
	DoNotContact = 'DO_NOT_CONTACT',
	MissingContactInfo = 'MISSING_CONTACT_INFO',
}

export enum EDebtAgreementStatus {
	Active = 'ACTIVE',
	Paid = 'PAID',
	Canceled = 'CANCELED',
}

// Persisted installment status.
// DUE_TODAY and OVERDUE should be derived from dueDate + amount/paid balance.
export enum EInstallmentStatus {
	Pending = 'PENDING',
	PartiallyPaid = 'PARTIALLY_PAID',
	Paid = 'PAID',
	Canceled = 'CANCELED',
}

export enum EPaymentMethod {
	Pix = 'PIX',
	Boleto = 'BOLETO',
	Manual = 'MANUAL',
	WebhookSimulated = 'WEBHOOK_SIMULATED',
}

export enum ECommunicationType {
	PreDueReminder = 'PRE_DUE_REMINDER',
	DueDateReminder = 'DUE_DATE_REMINDER',
	OverdueSoftNotice = 'OVERDUE_SOFT_NOTICE',
	OverdueFollowUp = 'OVERDUE_FOLLOW_UP',
	OverdueEscalation = 'OVERDUE_ESCALATION',
	PaymentConfirmation = 'PAYMENT_CONFIRMATION',
}

export enum ECommunicationChannel {
	WhatsApp = 'WHATSAPP',
	Email = 'EMAIL',
}

export enum ECommunicationStatus {
	Pending = 'PENDING',
	Generated = 'GENERATED',
	SentSimulated = 'SENT_SIMULATED',
	Skipped = 'SKIPPED',
	Failed = 'FAILED',
}

export enum EPaymentWebhookStatus {
	Received = 'RECEIVED',
	Processed = 'PROCESSED',
	Duplicated = 'DUPLICATED',
	Failed = 'FAILED',
}
