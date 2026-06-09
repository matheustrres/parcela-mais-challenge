import { createHash } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
	throw new Error('DATABASE_URL is required to run prisma/seed.ts');
}

const prisma = new PrismaClient({
	adapter: new PrismaPg({
		connectionString: databaseUrl,
	}),
});

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const SAO_PAULO_OFFSET = '-03:00';
const PHONE_PREFIX = '+5511999000';

const IDS = {
	clinic: '00000000-0000-4000-8000-000000000001',
	patients: {
		ana: '00000000-0000-4000-8000-000000000101',
		beto: '00000000-0000-4000-8000-000000000102',
		caio: '00000000-0000-4000-8000-000000000103',
		dora: '00000000-0000-4000-8000-000000000104',
		eva: '00000000-0000-4000-8000-000000000105',
		fabio: '00000000-0000-4000-8000-000000000106',
		gabi: '00000000-0000-4000-8000-000000000107',
		hugo: '00000000-0000-4000-8000-000000000108',
	},
	agreements: {
		anaPreDue: '00000000-0000-4000-8000-000000000201',
		betoDueToday: '00000000-0000-4000-8000-000000000202',
		caioOverdue2: '00000000-0000-4000-8000-000000000203',
		doraOverdue7: '00000000-0000-4000-8000-000000000204',
		evaOverdue15: '00000000-0000-4000-8000-000000000205',
		evaPartialRecent: '00000000-0000-4000-8000-000000000206',
		evaCanceled: '00000000-0000-4000-8000-000000000207',
		fabioDnc: '00000000-0000-4000-8000-000000000208',
		gabiMissingContact: '00000000-0000-4000-8000-000000000209',
		hugoAttemptToday: '00000000-0000-4000-8000-000000000210',
		evaDuplicateD7: '00000000-0000-4000-8000-000000000211',
		hugoHistory: '00000000-0000-4000-8000-000000000212',
	},
	installments: {
		anaPreDue: '00000000-0000-4000-8000-000000000301',
		betoDueToday: '00000000-0000-4000-8000-000000000302',
		caioOverdue2: '00000000-0000-4000-8000-000000000303',
		doraOverdue7: '00000000-0000-4000-8000-000000000304',
		evaOverdue15: '00000000-0000-4000-8000-000000000305',
		evaPartialRecent: '00000000-0000-4000-8000-000000000306',
		evaCanceled: '00000000-0000-4000-8000-000000000307',
		fabioDnc: '00000000-0000-4000-8000-000000000308',
		gabiMissingContact: '00000000-0000-4000-8000-000000000309',
		hugoAttemptToday: '00000000-0000-4000-8000-000000000310',
		evaDuplicateD7: '00000000-0000-4000-8000-000000000311',
		hugoHistory: '00000000-0000-4000-8000-000000000312',
	},
	payments: {
		evaPartialRecent: '00000000-0000-4000-8000-000000000401',
	},
	communications: {
		doraDueDateReminder: '00000000-0000-4000-8000-000000000501',
		evaDuplicateWhatsapp: '00000000-0000-4000-8000-000000000502',
		hugoAlreadyContactedToday: '00000000-0000-4000-8000-000000000503',
	},
} as const;

type DateParts = {
	year: number;
	month: number;
	day: number;
};

type TimeParts = {
	hour: number;
	minute: number;
};

function getDatePartsInSaoPaulo(date: Date): DateParts {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: SAO_PAULO_TIME_ZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(date);

	return {
		year: Number(parts.find((part) => part.type === 'year')?.value),
		month: Number(parts.find((part) => part.type === 'month')?.value),
		day: Number(parts.find((part) => part.type === 'day')?.value),
	};
}

function getTimePartsInSaoPaulo(date: Date): TimeParts {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: SAO_PAULO_TIME_ZONE,
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	}).formatToParts(date);

	return {
		hour: Number(parts.find((part) => part.type === 'hour')?.value),
		minute: Number(parts.find((part) => part.type === 'minute')?.value),
	};
}

function addDays(parts: DateParts, offsetDays: number): DateParts {
	const utcDate = new Date(
		Date.UTC(parts.year, parts.month - 1, parts.day + offsetDays),
	);

	return {
		year: utcDate.getUTCFullYear(),
		month: utcDate.getUTCMonth() + 1,
		day: utcDate.getUTCDate(),
	};
}

function formatDateSegment(value: number): string {
	return String(value).padStart(2, '0');
}

function makeSaoPauloInstant(parts: DateParts, hour: number, minute = 0): Date {
	return new Date(
		`${parts.year}-${formatDateSegment(parts.month)}-${formatDateSegment(parts.day)}T${formatDateSegment(hour)}:${formatDateSegment(minute)}:00${SAO_PAULO_OFFSET}`,
	);
}

function makeDueDate(parts: DateParts, offsetDays: number): Date {
	return makeSaoPauloInstant(addDays(parts, offsetDays), 12);
}

function hashPaymentPayload(input: {
	clinicId: string;
	installmentId: string;
	amountCents: number;
	method: 'PIX' | 'BOLETO' | 'MANUAL' | 'WEBHOOK_SIMULATED';
	externalReference: string | null;
	paidAt: Date;
}): string {
	return createHash('sha256')
		.update(
			JSON.stringify({
				clinicId: input.clinicId,
				installmentId: input.installmentId,
				amountCents: input.amountCents,
				method: input.method,
				externalReference: input.externalReference,
				paidAt: input.paidAt.toISOString(),
			}),
		)
		.digest('hex');
}

async function resetDatabase(): Promise<void> {
	await prisma.$transaction([
		prisma.paymentWebhookEvent.deleteMany(),
		prisma.communicationAttempt.deleteMany(),
		prisma.payment.deleteMany(),
		prisma.installment.deleteMany(),
		prisma.debtAgreement.deleteMany(),
		prisma.patient.deleteMany(),
		prisma.clinic.deleteMany(),
	]);
}

async function seed(): Promise<void> {
	const now = new Date();
	const todayInSaoPaulo = getDatePartsInSaoPaulo(now);
	const currentTimeInSaoPaulo = getTimePartsInSaoPaulo(now);
	const paymentRecentPaidAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);
	const yesterdayTenAm = makeSaoPauloInstant(addDays(todayInSaoPaulo, -1), 10);
	const sevenDaysAgoTenAm = makeSaoPauloInstant(
		addDays(todayInSaoPaulo, -7),
		10,
	);
	const communicationEarlierToday =
		currentTimeInSaoPaulo.hour === 0 && currentTimeInSaoPaulo.minute < 5
			? new Date(now.getTime() - 60 * 1000)
			: currentTimeInSaoPaulo.hour === 0
				? makeSaoPauloInstant(todayInSaoPaulo, 0, 5)
				: new Date(now.getTime() - 60 * 60 * 1000);

	const partialPaymentDemo = {
		clinicId: IDS.clinic,
		installmentId: IDS.installments.evaPartialRecent,
		amountCents: 15000,
		method: 'PIX' as const,
		externalReference: 'seed-payment-eva-partial-1',
		idempotencyKey: 'seed-eva-partial-payment-1',
		paidAt: paymentRecentPaidAt,
	};

	await resetDatabase();

	await prisma.clinic.create({
		data: {
			id: IDS.clinic,
			name: 'Clinica Sintetica Alpha',
		},
	});

	await prisma.patient.createMany({
		data: [
			{
				id: IDS.patients.ana,
				clinicId: IDS.clinic,
				name: 'Paciente Sintetico Ana 01',
				email: 'ana.seed@example.test',
				phone: `${PHONE_PREFIX}01`,
				preferredChannel: 'WHATSAPP',
				contactStatus: 'ACTIVE',
			},
			{
				id: IDS.patients.beto,
				clinicId: IDS.clinic,
				name: 'Paciente Sintetico Beto 02',
				email: 'beto.seed@example.test',
				phone: `${PHONE_PREFIX}02`,
				preferredChannel: 'WHATSAPP',
				contactStatus: 'ACTIVE',
			},
			{
				id: IDS.patients.caio,
				clinicId: IDS.clinic,
				name: 'Paciente Sintetico Caio 03',
				email: 'caio.seed@example.test',
				phone: `${PHONE_PREFIX}03`,
				preferredChannel: 'WHATSAPP',
				contactStatus: 'ACTIVE',
			},
			{
				id: IDS.patients.dora,
				clinicId: IDS.clinic,
				name: 'Paciente Sintetico Dora 04',
				email: 'dora.seed@example.test',
				phone: `${PHONE_PREFIX}04`,
				preferredChannel: 'WHATSAPP',
				contactStatus: 'ACTIVE',
			},
			{
				id: IDS.patients.eva,
				clinicId: IDS.clinic,
				name: 'Paciente Sintetico Eva 05',
				email: 'eva.seed@example.test',
				phone: `${PHONE_PREFIX}05`,
				preferredChannel: 'EMAIL',
				contactStatus: 'ACTIVE',
			},
			{
				id: IDS.patients.fabio,
				clinicId: IDS.clinic,
				name: 'Paciente Sintetico Fabio 06',
				email: 'fabio.seed@example.test',
				phone: `${PHONE_PREFIX}06`,
				preferredChannel: 'WHATSAPP',
				contactStatus: 'DO_NOT_CONTACT',
			},
			{
				id: IDS.patients.gabi,
				clinicId: IDS.clinic,
				name: 'Paciente Sintetico Gabi 07',
				email: null,
				phone: null,
				preferredChannel: null,
				contactStatus: 'MISSING_CONTACT_INFO',
			},
			{
				id: IDS.patients.hugo,
				clinicId: IDS.clinic,
				name: 'Paciente Sintetico Hugo 08',
				email: 'hugo.seed@example.test',
				phone: `${PHONE_PREFIX}08`,
				preferredChannel: 'WHATSAPP',
				contactStatus: 'ACTIVE',
			},
		],
	});

	await prisma.debtAgreement.createMany({
		data: [
			{
				id: IDS.agreements.anaPreDue,
				clinicId: IDS.clinic,
				patientId: IDS.patients.ana,
				totalAmountCents: 12000,
				installmentsCount: 1,
				status: 'ACTIVE',
			},
			{
				id: IDS.agreements.betoDueToday,
				clinicId: IDS.clinic,
				patientId: IDS.patients.beto,
				totalAmountCents: 18000,
				installmentsCount: 1,
				status: 'ACTIVE',
			},
			{
				id: IDS.agreements.caioOverdue2,
				clinicId: IDS.clinic,
				patientId: IDS.patients.caio,
				totalAmountCents: 22000,
				installmentsCount: 1,
				status: 'ACTIVE',
			},
			{
				id: IDS.agreements.doraOverdue7,
				clinicId: IDS.clinic,
				patientId: IDS.patients.dora,
				totalAmountCents: 35000,
				installmentsCount: 1,
				status: 'ACTIVE',
			},
			{
				id: IDS.agreements.evaOverdue15,
				clinicId: IDS.clinic,
				patientId: IDS.patients.eva,
				totalAmountCents: 60000,
				installmentsCount: 1,
				status: 'ACTIVE',
			},
			{
				id: IDS.agreements.evaPartialRecent,
				clinicId: IDS.clinic,
				patientId: IDS.patients.eva,
				totalAmountCents: 40000,
				installmentsCount: 1,
				status: 'ACTIVE',
			},
			{
				id: IDS.agreements.evaCanceled,
				clinicId: IDS.clinic,
				patientId: IDS.patients.eva,
				totalAmountCents: 17000,
				installmentsCount: 1,
				status: 'CANCELED',
			},
			{
				id: IDS.agreements.fabioDnc,
				clinicId: IDS.clinic,
				patientId: IDS.patients.fabio,
				totalAmountCents: 19000,
				installmentsCount: 1,
				status: 'ACTIVE',
			},
			{
				id: IDS.agreements.gabiMissingContact,
				clinicId: IDS.clinic,
				patientId: IDS.patients.gabi,
				totalAmountCents: 33000,
				installmentsCount: 1,
				status: 'ACTIVE',
			},
			{
				id: IDS.agreements.hugoAttemptToday,
				clinicId: IDS.clinic,
				patientId: IDS.patients.hugo,
				totalAmountCents: 21000,
				installmentsCount: 1,
				status: 'ACTIVE',
			},
			{
				id: IDS.agreements.evaDuplicateD7,
				clinicId: IDS.clinic,
				patientId: IDS.patients.eva,
				totalAmountCents: 28000,
				installmentsCount: 1,
				status: 'ACTIVE',
			},
			{
				id: IDS.agreements.hugoHistory,
				clinicId: IDS.clinic,
				patientId: IDS.patients.hugo,
				totalAmountCents: 9000,
				installmentsCount: 1,
				status: 'ACTIVE',
			},
		],
	});

	await prisma.installment.createMany({
		data: [
			{
				id: IDS.installments.anaPreDue,
				clinicId: IDS.clinic,
				debtAgreementId: IDS.agreements.anaPreDue,
				installmentNumber: 1,
				dueDate: makeDueDate(todayInSaoPaulo, 3),
				amountCents: 12000,
				paidAmountCents: 0,
				status: 'PENDING',
				paidAt: null,
				version: 0,
			},
			{
				id: IDS.installments.betoDueToday,
				clinicId: IDS.clinic,
				debtAgreementId: IDS.agreements.betoDueToday,
				installmentNumber: 1,
				dueDate: makeDueDate(todayInSaoPaulo, 0),
				amountCents: 18000,
				paidAmountCents: 0,
				status: 'PENDING',
				paidAt: null,
				version: 0,
			},
			{
				id: IDS.installments.caioOverdue2,
				clinicId: IDS.clinic,
				debtAgreementId: IDS.agreements.caioOverdue2,
				installmentNumber: 1,
				dueDate: makeDueDate(todayInSaoPaulo, -2),
				amountCents: 22000,
				paidAmountCents: 0,
				status: 'PENDING',
				paidAt: null,
				version: 0,
			},
			{
				id: IDS.installments.doraOverdue7,
				clinicId: IDS.clinic,
				debtAgreementId: IDS.agreements.doraOverdue7,
				installmentNumber: 1,
				dueDate: makeDueDate(todayInSaoPaulo, -7),
				amountCents: 35000,
				paidAmountCents: 0,
				status: 'PENDING',
				paidAt: null,
				version: 0,
			},
			{
				id: IDS.installments.evaOverdue15,
				clinicId: IDS.clinic,
				debtAgreementId: IDS.agreements.evaOverdue15,
				installmentNumber: 1,
				dueDate: makeDueDate(todayInSaoPaulo, -15),
				amountCents: 60000,
				paidAmountCents: 0,
				status: 'PENDING',
				paidAt: null,
				version: 0,
			},
			{
				id: IDS.installments.evaPartialRecent,
				clinicId: IDS.clinic,
				debtAgreementId: IDS.agreements.evaPartialRecent,
				installmentNumber: 1,
				dueDate: makeDueDate(todayInSaoPaulo, -7),
				amountCents: 40000,
				paidAmountCents: 15000,
				status: 'PARTIALLY_PAID',
				paidAt: null,
				version: 1,
			},
			{
				id: IDS.installments.evaCanceled,
				clinicId: IDS.clinic,
				debtAgreementId: IDS.agreements.evaCanceled,
				installmentNumber: 1,
				dueDate: makeDueDate(todayInSaoPaulo, -2),
				amountCents: 17000,
				paidAmountCents: 0,
				status: 'PENDING',
				paidAt: null,
				version: 0,
			},
			{
				id: IDS.installments.fabioDnc,
				clinicId: IDS.clinic,
				debtAgreementId: IDS.agreements.fabioDnc,
				installmentNumber: 1,
				dueDate: makeDueDate(todayInSaoPaulo, -2),
				amountCents: 19000,
				paidAmountCents: 0,
				status: 'PENDING',
				paidAt: null,
				version: 0,
			},
			{
				id: IDS.installments.gabiMissingContact,
				clinicId: IDS.clinic,
				debtAgreementId: IDS.agreements.gabiMissingContact,
				installmentNumber: 1,
				dueDate: makeDueDate(todayInSaoPaulo, -7),
				amountCents: 33000,
				paidAmountCents: 0,
				status: 'PENDING',
				paidAt: null,
				version: 0,
			},
			{
				id: IDS.installments.hugoAttemptToday,
				clinicId: IDS.clinic,
				debtAgreementId: IDS.agreements.hugoAttemptToday,
				installmentNumber: 1,
				dueDate: makeDueDate(todayInSaoPaulo, -2),
				amountCents: 21000,
				paidAmountCents: 0,
				status: 'PENDING',
				paidAt: null,
				version: 0,
			},
			{
				id: IDS.installments.evaDuplicateD7,
				clinicId: IDS.clinic,
				debtAgreementId: IDS.agreements.evaDuplicateD7,
				installmentNumber: 1,
				dueDate: makeDueDate(todayInSaoPaulo, -7),
				amountCents: 28000,
				paidAmountCents: 0,
				status: 'PENDING',
				paidAt: null,
				version: 0,
			},
			{
				id: IDS.installments.hugoHistory,
				clinicId: IDS.clinic,
				debtAgreementId: IDS.agreements.hugoHistory,
				installmentNumber: 1,
				dueDate: makeDueDate(todayInSaoPaulo, -20),
				amountCents: 9000,
				paidAmountCents: 0,
				status: 'PENDING',
				paidAt: null,
				version: 0,
			},
		],
	});

	await prisma.payment.create({
		data: {
			id: IDS.payments.evaPartialRecent,
			clinicId: partialPaymentDemo.clinicId,
			installmentId: partialPaymentDemo.installmentId,
			amountCents: partialPaymentDemo.amountCents,
			method: partialPaymentDemo.method,
			externalReference: partialPaymentDemo.externalReference,
			idempotencyKey: partialPaymentDemo.idempotencyKey,
			idempotencyPayloadHash: hashPaymentPayload(partialPaymentDemo),
			paidAt: partialPaymentDemo.paidAt,
			createdAt: partialPaymentDemo.paidAt,
		},
	});

	await prisma.communicationAttempt.createMany({
		data: [
			{
				id: IDS.communications.doraDueDateReminder,
				clinicId: IDS.clinic,
				patientId: IDS.patients.dora,
				installmentId: IDS.installments.doraOverdue7,
				type: 'DUE_DATE_REMINDER',
				channel: 'WHATSAPP',
				status: 'SENT_SIMULATED',
				scheduledFor: sevenDaysAgoTenAm,
				sentAt: sevenDaysAgoTenAm,
				skippedReason: null,
				message:
					'Seed sintético: lembrete anterior do dia do vencimento para a Dora.',
				aiGenerated: false,
				templateKey: 'collection.due_date_reminder.whatsapp.v1',
				createdAt: sevenDaysAgoTenAm,
				updatedAt: sevenDaysAgoTenAm,
			},
			{
				id: IDS.communications.evaDuplicateWhatsapp,
				clinicId: IDS.clinic,
				patientId: IDS.patients.eva,
				installmentId: IDS.installments.evaDuplicateD7,
				type: 'OVERDUE_FOLLOW_UP',
				channel: 'WHATSAPP',
				status: 'SENT_SIMULATED',
				scheduledFor: yesterdayTenAm,
				sentAt: yesterdayTenAm,
				skippedReason: null,
				message:
					'Seed sintético: follow-up anterior para demonstrar deduplicação por tipo+canal.',
				aiGenerated: false,
				templateKey: 'collection.overdue_follow_up.whatsapp.v1',
				createdAt: yesterdayTenAm,
				updatedAt: yesterdayTenAm,
			},
			{
				id: IDS.communications.hugoAlreadyContactedToday,
				clinicId: IDS.clinic,
				patientId: IDS.patients.hugo,
				installmentId: IDS.installments.hugoHistory,
				type: 'OVERDUE_SOFT_NOTICE',
				channel: 'WHATSAPP',
				status: 'SENT_SIMULATED',
				scheduledFor: communicationEarlierToday,
				sentAt: communicationEarlierToday,
				skippedReason: null,
				message:
					'Seed sintético: contato anterior do mesmo dia para ativar cooldown diário.',
				aiGenerated: false,
				templateKey: 'collection.overdue_soft_notice.whatsapp.v1',
				createdAt: communicationEarlierToday,
				updatedAt: communicationEarlierToday,
			},
		],
	});

	const summary = {
		clinicId: IDS.clinic,
		patients: 8,
		scenarios: {
			preDueDMinus3: IDS.installments.anaPreDue,
			dueTodayD0: IDS.installments.betoDueToday,
			overdueDPlus2: IDS.installments.caioOverdue2,
			overdueDPlus7Multichannel: IDS.installments.doraOverdue7,
			overdueDPlus15: IDS.installments.evaOverdue15,
			canceledAgreementSkip: IDS.installments.evaCanceled,
			doNotContactSkip: IDS.installments.fabioDnc,
			missingContactSkip: IDS.installments.gabiMissingContact,
			recentPartialPaymentSkip: IDS.installments.evaPartialRecent,
			alreadyContactedTodaySkip: IDS.installments.hugoAttemptToday,
			dedupeTypeChannel: IDS.installments.evaDuplicateD7,
		},
		idempotentPaymentDemo: partialPaymentDemo,
	};

	console.log(JSON.stringify(summary, null, 2));
}

function isDirectExecution(): boolean {
	const entrypoint = process.argv[1];
	if (!entrypoint) {
		return false;
	}
	return (
		entrypoint.endsWith('/prisma/seed.ts') ||
		entrypoint.endsWith('\\prisma\\seed.ts')
	);
}

if (isDirectExecution()) {
	seed()
		.catch((error) => {
			console.error('Seed failed');
			console.error(error);
			process.exitCode = 1;
		})
		.finally(async () => {
			await prisma.$disconnect();
		});
}
