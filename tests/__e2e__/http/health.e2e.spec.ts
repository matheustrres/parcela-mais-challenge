import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createAppFixture } from '../__helpers/app-fixture';

describe('Health API (e2e)', () => {
	let httpServer: Parameters<typeof request>[0];

	beforeAll(async () => {
		const fixture = await createAppFixture({
			shouldClearAllDb: true,
		});

		httpServer = fixture.app.getHttpServer();
	});

	it('should expose health endpoint and swagger document', async () => {
		const healthResponse = await request(httpServer).get('/health');

		expect(healthResponse.status).toBe(200);
		expect(healthResponse.body).toEqual({ status: 'ok' });

		const swaggerResponse = await request(httpServer).get('/api-json');

		expect(swaggerResponse.status).toBe(200);
		expect(Object.keys(swaggerResponse.body.paths)).toEqual(
			expect.arrayContaining([
				'/health',
				'/debt-agreements',
				'/payments',
				'/collection-rules/run',
				'/delinquents',
				'/installments',
				'/communication-attempts',
				'/dashboard/summary',
			]),
		);
	});
});
