import { execSync } from 'node:child_process';

import {
	PostgreSqlContainer,
	StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

let pgContainer: StartedPostgreSqlContainer;

export async function setup(): Promise<void> {
	console.log('\n[e2e] Starting containers...');

	[pgContainer] = await Promise.all([
		new PostgreSqlContainer('postgres:alpine')
			.withDatabase('parcela_mais_test_db')
			.withUsername('parcela_mais_test')
			.withPassword('parcela_mais_test')
			.start(),
	]);

	const databaseUrl = pgContainer.getConnectionUri();

	process.env['DATABASE_URL'] = databaseUrl;
	process.env['PG_USER'] = pgContainer.getUsername();
	process.env['PG_PASSWORD'] = pgContainer.getPassword();
	process.env['PG_HOST'] = pgContainer.getHost();
	process.env['PG_PORT'] = String(pgContainer.getFirstMappedPort());
	process.env['PG_DATABASE'] = pgContainer.getDatabase();

	console.log('[e2e] Running prisma migrate deploy...');

	execSync('npx prisma migrate deploy', {
		cwd: process.cwd(),
		stdio: 'inherit',
		env: { ...process.env, DATABASE_URL: databaseUrl },
	});

	console.log('[e2e] Environment ready.\n');
}

export async function teardown(): Promise<void> {
	await Promise.all([pgContainer?.stop()]);
}
