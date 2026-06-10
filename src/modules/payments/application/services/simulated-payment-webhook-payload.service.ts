import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { EPaymentMethod } from '@/@core/enums/domain';

export type SimulatedPaymentWebhookInput = {
	provider: string;
	eventId: string;
	clinicId: string;
	installmentId: string;
	externalReference?: string | null;
	amountCents: number;
	method: EPaymentMethod;
	paidAt: Date;
};

export type NormalizedSimulatedPaymentWebhookPayload = {
	provider: string;
	eventId: string;
	clinicId: string;
	installmentId: string;
	externalReference: string | null;
	amountCents: number;
	method: EPaymentMethod;
	paidAt: string;
};

@Injectable()
export class SimulatedPaymentWebhookPayloadService {
	normalize(
		input: SimulatedPaymentWebhookInput,
	): NormalizedSimulatedPaymentWebhookPayload {
		return {
			provider: input.provider.trim().toUpperCase(),
			eventId: input.eventId.trim(),
			clinicId: EntityUuid.createFrom(input.clinicId).toString(),
			installmentId: EntityUuid.createFrom(input.installmentId).toString(),
			externalReference: input.externalReference?.trim() || null,
			amountCents: input.amountCents,
			method: input.method,
			paidAt: input.paidAt.toISOString(),
		};
	}

	hash(payload: NormalizedSimulatedPaymentWebhookPayload): string {
		return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
	}

	buildIdempotencyKey(
		payload: NormalizedSimulatedPaymentWebhookPayload,
	): string {
		return `webhook:${payload.provider}:${payload.eventId}`;
	}
}
