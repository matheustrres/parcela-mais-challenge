import { Module } from '@nestjs/common';

import { PatientRepository } from './application/repositories/patient.repository';
import { PrismaPatientRepository } from './infrastructure/prisma/prisma-patient.repository';

@Module({
	imports: [],
	providers: [
		{
			provide: PatientRepository,
			useClass: PrismaPatientRepository,
		},
	],
	controllers: [],
	exports: [PatientRepository],
})
export class PatientsModule {}
