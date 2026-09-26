// Decision — the homeowner's recorded choice following an analysis.
// Separate from Analysis: the homeowner may decide differently from the recommendation,
// and the outcome can be recorded later.

export type DecisionChoice = "repair" | "replace" | "defer" | "undecided";
export type DecisionOutcome = "held_up" | "failed_again" | "replaced_anyway" | "pending";

export interface Decision {
  id: string; // ULID
  repairEventId: string;
  analysisId?: string; // null if decision made without analysis
  decision: DecisionChoice;
  decidedAt?: string; // when homeowner made the call
  homeownerNotes?: string;
  outcome?: DecisionOutcome; // recorded later: how did the decision turn out?
  outcomeRecordedAt?: string;
  createdAt: string;
}

export interface CreateDecisionInput {
  repairEventId: string;
  analysisId?: string;
  decision: DecisionChoice;
  homeownerNotes?: string;
}
