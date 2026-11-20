import { AIBrief } from './brief';
import { CoderProfile } from './coder';

export type OrderTier = 'EXPRESS' | 'STANDARD' | 'PRO' | 'TEMPLATE';

export type OrderStatus =
  | 'DRAFT'
  | 'DISPATCHING'
  | 'ACCEPTED'
  | 'BUILDING'
  | 'QA_TESTING'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export type EscrowStatus = 'UNPAID' | 'ESCROW_LOCKED' | 'RELEASED' | 'REFUNDED';

export interface CommitLogItem {
  hash: string;
  message: string;
  timestamp: string;
  milestoneId?: string;
  author: string;
}

export interface Order {
  id: string;
  tier: OrderTier;
  title: string;
  customerName: string;
  customerPrompt: string;
  templateId?: string;
  templateName?: string;
  framework?: string;
  priceVnd: number;
  /** Freelancer share fixed on the order (API mode); mock orders derive it from the current rate. */
  payoutVnd?: number;
  escrowStatus: EscrowStatus;
  status: OrderStatus;
  brief: AIBrief;
  assignedCoder?: CoderProfile;
  demoUrl?: string; // live Cloud Run preview (sandbox READY)
  sandboxStatus?: 'PENDING' | 'READY' | 'FAILED' | 'EXPIRED';
  sandboxError?: string;
  repoUrl?: string;
  repoHandoverPending?: boolean; // ACCEPTED, repo READY but not yet handed to a customer GitHub login
  createdAt: string;
  etaHours: number;
  completedAt?: string;
  commits?: CommitLogItem[];
  disputeReason?: string; // set while the order is DISPUTED (shown as CANCELLED)
}
