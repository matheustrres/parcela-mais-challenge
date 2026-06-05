export enum ECollectionRuleSkippedReason {
	InstallmentAlreadyPaid = 'INSTALLMENT_ALREADY_PAID',
	PatientDoNotContact = 'PATIENT_DO_NOT_CONTACT',
	PatientMissingContactInfo = 'PATIENT_MISSING_CONTACT_INFO',
	CommunicationTypeAlreadyExists = 'COMMUNICATION_TYPE_ALREADY_EXISTS',
	PatientAlreadyContactedToday = 'PATIENT_ALREADY_CONTACTED_TODAY',
	OutsideBusinessHours = 'OUTSIDE_BUSINESS_HOURS',
	NoRuleForCurrentDate = 'NO_RULE_FOR_CURRENT_DATE',
}
