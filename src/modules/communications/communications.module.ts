import { Module } from '@nestjs/common';

import { ClinicsModule } from '@/modules/clinics/clinics.module';
import { CommunicationAttemptRepository } from '@/modules/communications/application/repositories/communication-attempt.repository';
import { CommunicationAttemptsQueryRepository } from '@/modules/communications/application/repositories/communication-attempts-query.repository';
import { ListCommunicationAttemptsUseCase } from '@/modules/communications/application/use-cases/list-communication-attempts.use-case';
import { PrismaCommunicationAttemptRepository } from '@/modules/communications/infrastructure/prisma/prisma-communication-attempt.repository';
import { PrismaCommunicationAttemptsQueryRepository } from '@/modules/communications/infrastructure/prisma/prisma-communication-attempts-query.repository';
import { CommunicationsController } from '@/modules/communications/presentation/http/communications.controller';

@Module({
	imports: [ClinicsModule],
	providers: [
		ListCommunicationAttemptsUseCase,
		{
			provide: CommunicationAttemptRepository,
			useClass: PrismaCommunicationAttemptRepository,
		},
		{
			provide: CommunicationAttemptsQueryRepository,
			useClass: PrismaCommunicationAttemptsQueryRepository,
		},
	],
	controllers: [CommunicationsController],
	exports: [
		CommunicationAttemptRepository,
		CommunicationAttemptsQueryRepository,
		ListCommunicationAttemptsUseCase,
	],
})
export class CommunicationsModule {}
