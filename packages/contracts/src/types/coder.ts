export type CoderTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND';

export interface CoderProfile {
  id: string;
  name: string;
  avatar: string;
  tier: CoderTier;
  rating: number; // e.g. 4.98
  completedOrders: number;
  walletBalanceVnd: number;
  isOnline: boolean;
  specialties: string[];
  phone?: string;
}

export interface WaveOffer {
  id: string;
  orderId: string;
  title: string;
  tier: 'EXPRESS' | 'STANDARD' | 'PRO' | 'TEMPLATE';
  customerName: string;
  netPayoutVnd: number;
  deadlineHours: number;
  summary: string;
  expiresInSeconds: number;
  createdAt: string;
  templateName?: string;
}
