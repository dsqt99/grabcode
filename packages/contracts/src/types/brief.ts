export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED';

export interface QaCheck {
  name: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  detail: string;
}

export interface QaResult {
  status: 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED' | 'ERROR';
  commitHash: string | null;
  checks: QaCheck[];
  finishedAt?: string;
}

export interface Milestone {
  id: string; // e.g. "M1", "M2", "M3"
  title: string;
  description: string;
  weightPercent: number; // e.g. 20, 50, 30
  status: MilestoneStatus;
  submittedAt?: string;
  completedAt?: string;
  commitHash?: string;
  deliveryUrl?: string; // demo / repo / file link handed in on submit
  note?: string; // coder's submit note or the customer's revision request
  qa?: QaResult; // QA Gate of the last submit
}

export interface AcceptanceCriterion {
  id: string;
  text: string;
  passed: boolean;
}

export interface AIBrief {
  title: string;
  scopeSummary: string;
  features: string[];
  inScope: string[];
  outOfScope: string[];
  acceptanceCriteria: AcceptanceCriterion[];
  milestones: Milestone[];
  claudeMdContent: string;
}
