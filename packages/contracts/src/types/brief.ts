export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface Milestone {
  id: string; // e.g. "M1", "M2", "M3"
  title: string;
  description: string;
  weightPercent: number; // e.g. 20, 50, 30
  status: MilestoneStatus;
  completedAt?: string;
  commitHash?: string;
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
