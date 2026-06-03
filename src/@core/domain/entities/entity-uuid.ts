import { randomUUID } from 'node:crypto';

import { EntityId } from './entity-id';

export class EntityUuid extends EntityId {
	constructor(protected readonly uuidValue: string) {
		super(uuidValue);
	}

	static create(): EntityUuid {
		const uuid = randomUUID();
		return new EntityUuid(uuid);
	}

	static createFrom(value: string): EntityUuid {
		return new EntityUuid(value);
	}

	toId(): string {
		return this.uuidValue;
	}
}
