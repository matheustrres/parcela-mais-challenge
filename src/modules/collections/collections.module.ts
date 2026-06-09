import { Module } from '@nestjs/common';

import { ClinicsModule } from '@/modules/clinics/clinics.module';
import { CollectionCandidateRepository } from '@/modules/collections/application/repositories/collection-candidate.repository';
import { RunCollectionRulesUseCase } from '@/modules/collections/application/use-cases/run-collection-rules.use-case';
import { CollectionRulePolicyDomainService } from '@/modules/collections/domain/services/collection-rule-policy.service';
import { CollectionCommunicationMessageFactoryDomainService } from '@/modules/collections/domain/services/collections-communication-message-factory.service';
import { PrismaCollectionCandidateRepository } from '@/modules/collections/infrastructure/prisma/prisma-collection-candidate.repository';
import { CommunicationAttemptRepository } from '@/modules/communications/application/repositories/communication-attempt.repository';
import { PrismaCommunicationAttemptRepository } from '@/modules/communications/infrastructure/prisma/prisma-communication-attempt.repository';
import { PaymentsModule } from '@/modules/payments/payments.module';

@Module({
	imports: [ClinicsModule, PaymentsModule],
	providers: [
		RunCollectionRulesUseCase,
		CollectionRulePolicyDomainService,
		CollectionCommunicationMessageFactoryDomainService,
		{
			provide: CollectionCandidateRepository,
			useClass: PrismaCollectionCandidateRepository,
		},
		{
			provide: CommunicationAttemptRepository,
			useClass: PrismaCommunicationAttemptRepository,
		},
	],
	exports: [RunCollectionRulesUseCase],
})
export class CollectionsModule {}
