import { Transform } from 'class-transformer';
import {
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
} from 'class-validator';

import { ENodeEnv } from '@/@core/enums/node-env';

export class EnvSchema {
	@IsEnum(ENodeEnv)
	@IsNotEmpty()
	NODE_ENV?: ENodeEnv;

	@IsNumber()
	@IsOptional()
	@Transform(({ value }) => parseInt(value))
	PORT = 3000;

	@IsString()
	@IsNotEmpty()
	PG_USER!: string;

	@IsString()
	@IsNotEmpty()
	PG_PASSWORD!: string;

	@IsString()
	@IsNotEmpty()
	PG_HOST = 'localhost';

	@IsNumber()
	@IsNotEmpty()
	@Transform(({ value }) => parseInt(value))
	PG_PORT = 5432;

	@IsString()
	@IsNotEmpty()
	PG_DATABASE!: string;

	@IsString()
	@IsNotEmpty()
	DATABASE_URL!: string;

	@IsString()
	@IsOptional()
	CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001';
}
