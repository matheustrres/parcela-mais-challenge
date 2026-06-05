import { ECollectionRuleSkippedReason } from '../enums/collection-rule-skipped-reason';

import {
	ECommunicationChannel,
	ECommunicationType,
} from '@/@core/enums/domain';

export type CollectionRuleAction = {
	type: ECommunicationType;
	channel: ECommunicationChannel;
};

export type CollectionRuleDecision = {
	shouldCommunicate: boolean;
	actions: CollectionRuleAction[];
	skippedReason: ECollectionRuleSkippedReason | null;
};
