import { Module } from '@nestjs/common';

import { ClinicsModule } from '@/modules/clinics/clinics.module';
import { CollectionCandidateRepository } from '@/modules/collections/application/repositories/collection-candidate.repository';
import { DelinquentPatientsQueryRepository } from '@/modules/collections/application/repositories/delinquent-patients-query.repository';
import { ListDelinquentPatientsUseCase } from '@/modules/collections/application/use-cases/list-delinquent-patients.use-case';
import { RunCollectionRulesUseCase } from '@/modules/collections/application/use-cases/run-collection-rules.use-case';
import { CollectionPriorityScoreDomainService } from '@/modules/collections/domain/services/collection-priority-score.service';
import { CollectionRulePolicyDomainService } from '@/modules/collections/domain/services/collection-rule-policy.service';
import { CollectionCommunicationMessageFactoryDomainService } from '@/modules/collections/domain/services/collections-communication-message-factory.service';
import { PrismaCollectionCandidateRepository } from '@/modules/collections/infrastructure/prisma/prisma-collection-candidate.repository';
import { PrismaDelinquentPatientsQueryRepository } from '@/modules/collections/infrastructure/prisma/prisma-delinquent-patients-query.repository';
import { CollectionsController } from '@/modules/collections/presentation/http/collections.controller';
import { CommunicationsModule } from '@/modules/communications/communications.module';
import { PaymentsModule } from '@/modules/payments/payments.module';

@Module({
	imports: [ClinicsModule, PaymentsModule, CommunicationsModule],
	providers: [
		RunCollectionRulesUseCase,
		ListDelinquentPatientsUseCase,
		CollectionPriorityScoreDomainService,
		CollectionRulePolicyDomainService,
		CollectionCommunicationMessageFactoryDomainService,
		{
			provide: CollectionCandidateRepository,
			useClass: PrismaCollectionCandidateRepository,
		},
		{
			provide: DelinquentPatientsQueryRepository,
			useClass: PrismaDelinquentPatientsQueryRepository,
		},
	],
	controllers: [CollectionsController],
	exports: [RunCollectionRulesUseCase, ListDelinquentPatientsUseCase],
})
export class CollectionsModule {}
