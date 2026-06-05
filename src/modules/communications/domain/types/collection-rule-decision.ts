import {
	ECommunicationChannel,
	ECommunicationType,
} from '@/@core/enums/domain';

import { ECollectionRuleSkippedReason } from '@/modules/communications/domain/enums/collection-rule-skipped-reason';

export type CollectionRuleAction = {
	type: ECommunicationType;
	channel: ECommunicationChannel;
};

export type CollectionRuleDecision = {
	shouldCommunicate: boolean;
	actions: CollectionRuleAction[];
	skippedReason: ECollectionRuleSkippedReason | null;
};
