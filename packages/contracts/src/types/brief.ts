export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED';

export interface Milestone {
  id: string; // e.g. "M1", "M2", "M3"
  title: string;
  description: string;
  weightPercent: number; // e.g. 20, 50, 30
  status: MilestoneStatus;
  submittedAt?: string;
  completedAt?: string;
  commitHash?: string;
  note?: string; // coder's submit note or the customer's revision request
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
