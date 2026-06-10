import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { cleanDatabase } from './database-cleaner';

import { AppModule } from '@/app.module';

import { DatabaseService } from '@/shared/modules/database/database.service';
import { setupSwaggerDocs } from '@/shared/swagger';

type CreateAppFixtureOptions = {
	shouldClearAllDb: boolean;
};

export async function createAppFixture({
	shouldClearAllDb,
}: CreateAppFixtureOptions): Promise<{
	app: INestApplication;
	db: DatabaseService;
}> {
	const module = await Test.createTestingModule({
		imports: [AppModule],
	}).compile();

	const app = module.createNestApplication();

	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		}),
	);
	setupSwaggerDocs(app);
	await app.init();

	const db = module.get(DatabaseService);

	if (shouldClearAllDb) {
		await cleanDatabase(db);
	}

	return {
		app,
		db,
	};
}
