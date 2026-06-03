import { DatabaseService } from '@/shared/modules/database/database.service';

export async function cleanDatabase(db: DatabaseService): Promise<void> {
	const tableNames = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    AND tablename != '_prisma_migrations'
  `;

	for (const { tablename } of tableNames) {
		await db.$executeRawUnsafe(
			`TRUNCATE TABLE "public"."${tablename}" CASCADE`,
		);
	}
}
