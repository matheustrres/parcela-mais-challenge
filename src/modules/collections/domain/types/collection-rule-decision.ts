import { ECollectionRuleSkippedReason } from '../enums/collection-rule-skipped-reason';

import {
	ECommunicationChannel,
	ECommunicationType,
} from '@/@core/enums/domain';

export type CollectionRuleDecisionItem = {
	type: ECommunicationType | null;
	channel: ECommunicationChannel | null;
	status: 'GENERATED' | 'SKIPPED';
	skippedReason: ECollectionRuleSkippedReason | null;
};

export type CollectionRuleDecision = {
	items: CollectionRuleDecisionItem[];
};
