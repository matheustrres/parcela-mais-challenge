import {
	CreateEntityProps,
	EntityMeta,
	UpdatableEntity,
} from '@/@core/domain/entities/entity';
import { EntityId } from '@/@core/domain/entities/entity-id';
import { EntityUuid } from '@/@core/domain/entities/entity-uuid';
import { DomainException } from '@/@core/domain/exceptions/domain-exception';
import { Guard } from '@/@core/domain/logic/guard';

type ClinicEntityProps = {
	name: string;
};

type ClinicEntityConstructor = CreateEntityProps<ClinicEntityProps>;

export class ClinicEntity extends UpdatableEntity<ClinicEntityProps> {
	private constructor(props: ClinicEntityConstructor) {
		const normalizedProps = ClinicEntity.normalizeProps(props.props);
		ClinicEntity.validateProps(normalizedProps);
		super({
			...props,
			props: normalizedProps,
		});
	}

	static create(props: ClinicEntityProps): ClinicEntity {
		return new ClinicEntity({
			id: EntityUuid.create(),
			props,
		});
	}

	static createFrom(
		id: EntityId,
		props: ClinicEntityProps,
		meta?: EntityMeta,
	): ClinicEntity {
		return new ClinicEntity({
			id,
			props,
			meta,
		});
	}

	changeName(name: string): void {
		const normalizedName = name.trim();
		ClinicEntity.validateProps({
			...this.props,
			name: normalizedName,
		});
		this.props.name = normalizedName;
		this.touch();
	}

	get name(): string {
		return this.props.name;
	}

	private static normalizeProps(props: ClinicEntityProps): ClinicEntityProps {
		return {
			...props,
			name: props.name.trim(),
		};
	}

	private static validateProps(props: ClinicEntityProps): void {
		if (Guard.isEmpty(props.name) || props.name.trim().length === 0) {
			throw new DomainException('CLINIC_NAME_REQUIRED');
		}
		if (props.name.trim().length < 2) {
			throw new DomainException('CLINIC_NAME_TOO_SHORT');
		}
		if (props.name.trim().length > 120) {
			throw new DomainException('CLINIC_NAME_TOO_LONG');
		}
	}
}
