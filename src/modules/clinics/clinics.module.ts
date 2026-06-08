import { Module } from '@nestjs/common';

import { ClinicRepository } from './application/repositories/clinic.repository';
import { PrismaClinicRepository } from './infrastructure/prisma/prisma-clinic.repository';

@Module({
	imports: [],
	providers: [
		{
			provide: ClinicRepository,
			useClass: PrismaClinicRepository,
		},
	],
	controllers: [],
	exports: [ClinicRepository],
})
export class ClinicsModule {}
