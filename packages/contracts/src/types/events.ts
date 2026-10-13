import { Order } from './order';
import { MilestoneStatus } from './brief';
import { WaveOffer, CoderProfile } from './coder';

export type GrabCodeEventType =
  | 'ORDER_DISPATCHED'
  | 'ORDER_ACCEPTED'
  | 'ORDER_REJECTED'
  | 'MILESTONE_UPDATED'
  | 'ORDER_DELIVERED'
  | 'ORDER_COMPLETED'
  | 'CHAT_MESSAGE_SENT'
  | 'CODER_STATUS_CHANGED';

export interface ChatMessage {
  id: string;
  orderId: string;
  sender: 'CUSTOMER' | 'CODER' | 'SYSTEM';
  senderName: string;
  text: string;
  timestamp: string;
}

export interface OrderDispatchedPayload {
  order: Order;
  offer: WaveOffer;
}

export interface OrderAcceptedPayload {
  orderId: string;
  coder: CoderProfile;
}

export interface OrderRejectedPayload {
  orderId: string;
  reason?: string;
}

export interface MilestoneUpdatedPayload {
  orderId: string;
  milestoneId: string;
  status: MilestoneStatus;
  commitHash?: string;
  commitMessage?: string;
}

export interface OrderDeliveredPayload {
  orderId: string;
  demoUrl: string;
  repoUrl: string;
}

export interface OrderCompletedPayload {
  orderId: string;
  payoutVnd: number;
}

export interface CoderStatusChangedPayload {
  coderId: string;
  isOnline: boolean;
}

export interface GrabCodeBaseEvent<T extends GrabCodeEventType, P> {
  type: T;
  payload: P;
  timestamp: string;
}

export type GrabCodeEvent =
  | GrabCodeBaseEvent<'ORDER_DISPATCHED', OrderDispatchedPayload>
  | GrabCodeBaseEvent<'ORDER_ACCEPTED', OrderAcceptedPayload>
  | GrabCodeBaseEvent<'ORDER_REJECTED', OrderRejectedPayload>
  | GrabCodeBaseEvent<'MILESTONE_UPDATED', MilestoneUpdatedPayload>
  | GrabCodeBaseEvent<'ORDER_DELIVERED', OrderDeliveredPayload>
  | GrabCodeBaseEvent<'ORDER_COMPLETED', OrderCompletedPayload>
  | GrabCodeBaseEvent<'CHAT_MESSAGE_SENT', ChatMessage>
  | GrabCodeBaseEvent<'CODER_STATUS_CHANGED', CoderStatusChangedPayload>;
