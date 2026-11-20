// Emits contracts/openapi/core-api.openapi.json and contracts/events/*.schema.json from the zod schemas.
// Run: pnpm --filter @grabcode/contracts run generate
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  AIBriefSchema,
  BriefJobCreateSchema,
  BriefJobSchema,
  ErrorResponseSchema,
} from '../src/schemas/brief.ts';
import {
  BriefFailedEventSchema,
  BriefGeneratedEventSchema,
  BriefRequestedEventSchema,
  RepoFailedEventSchema,
  RepoProvisionedEventSchema,
  OrderEventSchema,
  ORDER_SUBJECTS,
  RepoRequestedEventSchema,
  EscrowEventSchema,
  DispatchEventSchema,
  MilestoneEventSchema,
  QaRequestedEventSchema,
  QaCompletedEventSchema,
  DeployRequestedEventSchema,
  DeployReadyEventSchema,
  DeployFailedEventSchema,
  DeployExpiredEventSchema,
  ChatPostedEventSchema,
  PaymentReportedEventSchema,
  PayoutRequestedEventSchema,
  RepoHandoverRequestedEventSchema,
  RepoHandedOverEventSchema,
  SUBJECTS,
} from '../src/schemas/events.ts';
import {
  AdminCoderSchema,
  AdminCoderListSchema,
  AdminCoderPatchSchema,
  AdminOrderSchema,
  AdminOrderDetailSchema,
  AdminOrderListSchema,
  ConfirmPaymentSchema,
  OrderQuoteSchema,
  DisputeResolveSchema,
  MonitorSchema,
  PayoutSchema,
  PayoutCreateSchema,
  PayoutDecisionSchema,
  PayoutListSchema,
  RefundListSchema,
  RefundPaidSchema,
  RefundSchema,
  SuspenseListSchema,
  SuspenseResolveSchema,
} from '../src/schemas/admin.ts';
import { JobListSchema, OfferListSchema, PresenceSchema } from '../src/schemas/dispatch.ts';
import { DevDepositSchema, PaymentInstructionsSchema, SepayWebhookSchema, WalletSchema } from '../src/schemas/payment.ts';
import {
  MilestoneRejectSchema,
  MilestoneSubmitSchema,
  OrderCreateSchema,
  OrderListSchema,
  OrderSchema,
  OrderTransitionSchema,
  RefundAccountResponseSchema,
  RefundAccountSchema,
} from '../src/schemas/order.ts';
import { OrderRepoSchema, RepoCreateSchema, RepoHandoverSchema } from '../src/schemas/repo.ts';
import { ChatListSchema, ChatMessageSchema, ChatSendSchema, RealtimeHintSchema, RealtimeTokenSchema } from '../src/schemas/realtime.ts';
import {
  AddRoleSchema,
  AuthProvidersSchema,
  ChangePasswordSchema,
  PushKeySchema,
  PushSubscriptionSchema,
  PushUnsubscribeSchema,
  CoderProfileDetailsSchema,
  CustomerProfileSchema,
  DevLoginSchema,
  MeSchema,
  PasswordLoginSchema,
  RegisterSchema,
  UpdateMeSchema,
} from '../src/schemas/auth.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const write = (rel: string, data: unknown) => {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log('wrote', rel);
};
const schema = (s: z.ZodTypeAny, io: 'input' | 'output' = 'output') => {
  const { $schema, ...rest } = z.toJSONSchema(s, { io, unrepresentable: 'any' }) as Record<string, unknown>;
  void $schema;
  return rest;
};
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (name: string) => ({ 'application/json': { schema: ref(name) } });
const unauthorized = { description: 'No valid session', content: json('ErrorResponse') };
const provider = { name: 'provider', in: 'path', required: true, schema: { type: 'string', enum: ['github', 'google'] } };
const orderId = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
const milestoneId = { name: 'milestoneId', in: 'path', required: true, schema: { type: 'string' } };
const adminOnly = { description: 'Missing ADMIN role', content: json('ErrorResponse') };
const notFound = { description: 'Not found', content: json('ErrorResponse') };
/** A uuid path id (user, payout, refund). */
const userId = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
const role = { name: 'role', in: 'query', required: false, description: 'Role for a new account (or added if missing).', schema: { type: 'string', enum: ['CUSTOMER', 'CODER'] } };

write('openapi/core-api.openapi.json', {
  openapi: '3.1.0',
  info: { title: 'GrabCode core-api', version: '0.1.0' },
  servers: [{ url: 'http://localhost:4000' }],
  paths: {
    '/v1/briefs': {
      post: {
        operationId: 'createBriefJob',
        summary: 'Queue an AI brief generation job (async, poll GET /v1/briefs/{id})',
        requestBody: { required: true, content: json('BriefJobCreate') },
        responses: {
          '202': { description: 'Accepted', content: json('BriefJob') },
          '400': { description: 'Validation error', content: json('ErrorResponse') },
          '429': { description: 'Too many briefs from this IP (20 per hour), retry later', content: json('ErrorResponse') },
        },
      },
    },
    '/v1/briefs/{id}': {
      get: {
        operationId: 'getBriefJob',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'OK', content: json('BriefJob') },
          '404': { description: 'Not found', content: json('ErrorResponse') },
        },
      },
    },
    '/v1/auth/providers': {
      get: { operationId: 'getAuthProviders', responses: { '200': { description: 'OK', content: json('AuthProviders') } } },
    },
    '/v1/auth/{provider}': {
      get: {
        operationId: 'startOAuthLogin',
        summary:
          'Browser navigation: redirects to the OAuth provider. `redirect` must be an allowed web origin URL. `link=1` (signed in) attaches that provider login to the current account instead of signing in; never merges two existing accounts.',
        parameters: [
          provider,
          role,
          { name: 'redirect', in: 'query', required: false, schema: { type: 'string', format: 'uri' } },
          { name: 'link', in: 'query', required: false, schema: { type: 'string', enum: ['1'] } },
        ],
        responses: { '302': { description: 'Redirect to provider' }, '404': { description: 'Provider not configured' } },
      },
    },
    '/v1/auth/{provider}/callback': {
      get: {
        operationId: 'oauthCallback',
        summary: 'Provider redirects here; sets the gc_session cookie (or links the identity when started with link=1) and redirects back (adds ?auth_error=state|oauth|link_taken|link_session on failure).',
        parameters: [provider],
        responses: { '302': { description: 'Redirect to app' } },
      },
    },
    '/v1/auth/register': {
      post: {
        operationId: 'register',
        summary: 'Email/password sign-up. Sets the gc_session cookie.',
        requestBody: { required: true, content: json('Register') },
        responses: {
          '201': { description: 'Created', content: json('Me') },
          '400': { description: 'Validation error', content: json('ErrorResponse') },
          '409': { description: 'Email already registered', content: json('ErrorResponse') },
        },
      },
    },
    '/v1/auth/login': {
      post: {
        operationId: 'passwordLogin',
        summary: 'Email/password login. Sets the gc_session cookie.',
        requestBody: { required: true, content: json('PasswordLogin') },
        responses: { '200': { description: 'OK', content: json('Me') }, '401': { description: 'Wrong email or password', content: json('ErrorResponse') }, '429': { description: 'Too many failed attempts for this email or IP; retry later', content: json('ErrorResponse') } },
      },
    },
    '/v1/auth/dev-login': {
      post: {
        operationId: 'devLogin',
        summary: 'Local development only (AUTH_DEV_LOGIN=true). Sets the gc_session cookie.',
        requestBody: { required: true, content: json('DevLogin') },
        responses: { '200': { description: 'OK', content: json('Me') }, '404': { description: 'Disabled' } },
      },
    },
    '/v1/auth/logout': {
      post: { operationId: 'logout', responses: { '204': { description: 'Session revoked, cookie cleared' } } },
    },
    '/v1/me': {
      get: { operationId: 'getMe', responses: { '200': { description: 'OK', content: json('Me') }, '401': unauthorized } },
      patch: {
        operationId: 'updateMe',
        requestBody: { required: true, content: json('UpdateMe') },
        responses: { '200': { description: 'OK', content: json('Me') }, '400': { description: 'Validation error', content: json('ErrorResponse') }, '401': unauthorized },
      },
    },
    '/v1/me/roles': {
      post: {
        operationId: 'addRole',
        summary: 'Add CUSTOMER or CODER to the signed-in account (idempotent).',
        requestBody: { required: true, content: json('AddRole') },
        responses: { '200': { description: 'OK', content: json('Me') }, '400': { description: 'Validation error', content: json('ErrorResponse') }, '401': unauthorized },
      },
    },
    '/v1/me/coder-profile': {
      put: {
        operationId: 'saveCoderProfile',
        summary: 'Create or replace the coder profile. Requires the CODER role.',
        requestBody: { required: true, content: json('CoderProfileDetails') },
        responses: { '200': { description: 'OK', content: json('Me') }, '400': { description: 'Validation error', content: json('ErrorResponse') }, '401': unauthorized, '403': { description: 'Missing CODER role', content: json('ErrorResponse') } },
      },
    },
    '/v1/me/customer-profile': {
      put: {
        operationId: 'saveCustomerProfile',
        summary: 'Create or replace the company profile. Requires the CUSTOMER role.',
        requestBody: { required: true, content: json('CustomerProfile') },
        responses: { '200': { description: 'OK', content: json('Me') }, '400': { description: 'Validation error', content: json('ErrorResponse') }, '401': unauthorized, '403': { description: 'Missing CUSTOMER role', content: json('ErrorResponse') } },
      },
    },
    '/v1/me/password': {
      post: {
        operationId: 'changePassword',
        summary: 'Email accounts only. Revokes every other session of the user.',
        requestBody: { required: true, content: json('ChangePassword') },
        responses: { '204': { description: 'Changed' }, '400': { description: 'Validation error or not an email account', content: json('ErrorResponse') }, '401': { description: 'Not signed in or wrong current password', content: json('ErrorResponse') } },
      },
    },
    '/v1/push/key': {
      get: {
        operationId: 'getPushKey',
        summary: 'VAPID public key for PushManager.subscribe. Public.',
        responses: { '200': { description: 'OK', content: json('PushKey') }, '404': { description: 'WebPush not configured', content: json('ErrorResponse') } },
      },
    },
    '/v1/me/push-subscriptions': {
      put: {
        operationId: 'savePushSubscription',
        summary: "Store this browser's WebPush subscription for the signed-in user (upsert by endpoint). Sent when notifications.push is on.",
        requestBody: { required: true, content: json('PushSubscription') },
        responses: { '204': { description: 'Saved' }, '400': { description: 'Validation error', content: json('ErrorResponse') }, '401': unauthorized },
      },
      delete: {
        operationId: 'deletePushSubscription',
        summary: 'Forget one endpoint of the signed-in user. 204 even if unknown.',
        requestBody: { required: true, content: json('PushUnsubscribe') },
        responses: { '204': { description: 'Deleted' }, '401': unauthorized },
      },
    },
    '/v1/repos': {
      post: {
        operationId: 'requestOrderRepo',
        summary: 'Queue creation of the private GitHub repo for an order (its assigned coder). Idempotent per orderId; a FAILED repo is re-queued. Poll GET /v1/repos/{orderId}.',
        requestBody: { required: true, content: json('RepoCreate') },
        responses: {
          '202': { description: 'Accepted', content: json('OrderRepo') },
          '400': { description: 'Validation error', content: json('ErrorResponse') },
          '401': unauthorized,
          '403': { description: 'Not the assigned coder of the order', content: json('ErrorResponse') },
          '404': { description: 'Order not found', content: json('ErrorResponse') },
        },
      },
    },
    '/v1/repos/{orderId}': {
      get: {
        operationId: 'getOrderRepo',
        summary: 'Customer or assigned coder of the order.',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'OK', content: json('OrderRepo') },
          '401': unauthorized,
          '404': { description: 'Not found', content: json('ErrorResponse') },
        },
      },
    },
    '/v1/repos/{orderId}/handover': {
      post: {
        operationId: 'handoverOrderRepo',
        summary: 'Customer of an ACCEPTED order names the GitHub login that gets admin on the repo (when the account has no GitHub login, or the invite was rejected).',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: json('RepoHandover') },
        responses: {
          '202': { description: 'Handover queued', content: json('OrderRepo') },
          '400': { description: 'Validation error', content: json('ErrorResponse') },
          '401': unauthorized,
          '404': { description: 'Not the customer of the order', content: json('ErrorResponse') },
          '409': { description: 'Order not ACCEPTED, repo not READY, or already handed over to a login', content: json('ErrorResponse') },
        },
      },
    },
    '/v1/orders': {
      post: {
        operationId: 'createOrder',
        summary: 'Create a DRAFT order (CUSTOMER role). Price and ETA are computed by the server.',
        requestBody: { required: true, content: json('OrderCreate') },
        responses: {
          '201': { description: 'Created', content: json('Order') },
          '400': { description: 'Validation error', content: json('ErrorResponse') },
          '401': unauthorized,
          '403': { description: 'Missing CUSTOMER role', content: json('ErrorResponse') },
        },
      },
      get: {
        operationId: 'listOrders',
        summary: 'scope=mine: own orders as customer + assigned orders as coder. Coders receive new orders as wave offers (GET /v1/me/offers).',
        parameters: [{ name: 'scope', in: 'query', required: false, schema: { type: 'string', enum: ['mine'], default: 'mine' } }],
        responses: { '200': { description: 'OK', content: json('OrderList') }, '401': unauthorized, '403': { description: 'Missing CODER role', content: json('ErrorResponse') } },
      },
    },
    '/v1/orders/{id}': {
      get: {
        operationId: 'getOrder',
        summary: 'Customer or assigned coder only (coders see unassigned orders inside their offers).',
        parameters: [orderId],
        responses: { '200': { description: 'OK', content: json('Order') }, '401': unauthorized, '404': { description: 'Not found', content: json('ErrorResponse') } },
      },
    },
    '/v1/orders/{id}/transitions': {
      post: {
        operationId: 'transitionOrder',
        summary:
          'Move the order. IN_PROGRESS->DELIVERED (assigned coder, all milestones approved), DELIVERED->ACCEPTED|IN_PROGRESS (customer; ACCEPTED pays every share still held, incl. the last milestone, and hands the repo over; IN_PROGRESS = revision, reason of 10+ chars required, reopens the last milestone with it), IN_PROGRESS|DELIVERED->DISPUTED (customer, reason required; freezes the escrow still held). DRAFT->FUNDED (price quoted and escrow holds it), FUNDED->DISPATCHED (wave sent) and DISPATCHED->IN_PROGRESS (POST /v1/offers/{id}/accept) are taken by the server.',
        parameters: [orderId],
        requestBody: { required: true, content: json('OrderTransition') },
        responses: {
          '200': { description: 'OK', content: json('Order') },
          '400': { description: 'Validation error', content: json('ErrorResponse') },
          '401': unauthorized,
          '403': { description: 'Not a party allowed to take this transition', content: json('ErrorResponse') },
          '404': { description: 'Not found', content: json('ErrorResponse') },
          '409': { description: 'Transition not allowed from the current status', content: json('ErrorResponse') },
        },
      },
    },
    '/v1/orders/{id}/milestones/{milestoneId}/submit': {
      post: {
        operationId: 'submitMilestone',
        summary: 'Assigned coder submits the current IN_PROGRESS milestone (in order) for review, optionally pinned to a commit pushed to the order repo.',
        parameters: [orderId, milestoneId],
        requestBody: { required: false, content: json('MilestoneSubmit') },
        responses: {
          '200': { description: 'OK', content: json('Order') },
          '400': { description: 'Validation error or commit not in the order repo', content: json('ErrorResponse') },
          '401': unauthorized,
          '403': { description: 'Not the assigned coder', content: json('ErrorResponse') },
          '404': { description: 'Not found', content: json('ErrorResponse') },
          '409': { description: 'Order not IN_PROGRESS or milestone not the current one', content: json('ErrorResponse') },
        },
      },
    },
    '/v1/orders/{id}/milestones/{milestoneId}/approve': {
      post: {
        operationId: 'approveMilestone',
        summary: 'Customer approves a SUBMITTED milestone: COMPLETED, its weight share of escrow is released to the coder, the next milestone starts. 409 while its QA gate is FAILED (request changes instead); QA ERROR/SKIPPED/RUNNING do not block.',
        parameters: [orderId, milestoneId],
        responses: {
          '200': { description: 'OK', content: json('Order') },
          '401': unauthorized,
          '403': { description: 'Not the customer', content: json('ErrorResponse') },
          '404': { description: 'Not found', content: json('ErrorResponse') },
          '409': { description: 'Order not IN_PROGRESS (e.g. DISPUTED) or milestone not SUBMITTED', content: json('ErrorResponse') },
        },
      },
    },
    '/v1/orders/{id}/milestones/{milestoneId}/reject': {
      post: {
        operationId: 'rejectMilestone',
        summary: 'Customer asks for changes on a SUBMITTED milestone: back to IN_PROGRESS with the note.',
        parameters: [orderId, milestoneId],
        requestBody: { required: true, content: json('MilestoneReject') },
        responses: {
          '200': { description: 'OK', content: json('Order') },
          '400': { description: 'Validation error', content: json('ErrorResponse') },
          '401': unauthorized,
          '403': { description: 'Not the customer', content: json('ErrorResponse') },
          '404': { description: 'Not found', content: json('ErrorResponse') },
          '409': { description: 'Order not IN_PROGRESS or milestone not SUBMITTED', content: json('ErrorResponse') },
        },
      },
    },
    '/v1/orders/{id}/messages': {
      get: {
        operationId: 'listOrderMessages',
        summary: 'Customer / assigned coder: chat of the order, oldest first (last 200).',
        parameters: [orderId],
        responses: { '200': { description: 'OK', content: json('ChatList') }, '401': unauthorized, '404': { description: 'Not found', content: json('ErrorResponse') } },
      },
      post: {
        operationId: 'sendOrderMessage',
        summary: 'Customer / assigned coder posts a chat message; both parties get a `chat` realtime hint.',
        parameters: [orderId],
        requestBody: { required: true, content: json('ChatSend') },
        responses: {
          '201': { description: 'Created', content: json('ChatMessage') },
          '400': { description: 'Validation error', content: json('ErrorResponse') },
          '401': unauthorized,
          '404': { description: 'Not found', content: json('ErrorResponse') },
        },
      },
    },
    '/v1/realtime/token': {
      get: {
        operationId: 'getRealtimeToken',
        summary: 'Centrifugo connection token for the caller, subscribed server-side to user.<id>. Pushes are RealtimeHint objects: refetch over REST.',
        responses: { '200': { description: 'OK', content: json('RealtimeToken') }, '401': unauthorized, '404': { description: 'Realtime not configured' } },
      },
    },
    '/v1/orders/{id}/payment': {
      get: {
        operationId: 'getOrderPayment',
        summary: 'Customer only: bank transfer instructions (VietQR) and how much is paid / still due.',
        parameters: [orderId],
        responses: { '200': { description: 'OK', content: json('PaymentInstructions') }, '401': unauthorized, '404': { description: 'Not found', content: json('ErrorResponse') } },
      },
    },
    '/v1/orders/{id}/refund-account': {
      get: {
        operationId: 'getRefundAccount',
        summary: 'Customer only: the bank account a refund of this order goes to (null until entered).',
        parameters: [orderId],
        responses: { '200': { description: 'OK', content: json('RefundAccountResponse') }, '401': unauthorized, '404': { description: 'Not found', content: json('ErrorResponse') } },
      },
      put: {
        operationId: 'putRefundAccount',
        summary: 'Customer only: set the bank account refunds of this order are transferred to; admins see it on pending refunds.',
        parameters: [orderId],
        requestBody: { required: true, content: json('RefundAccount') },
        responses: {
          '200': { description: 'OK', content: json('RefundAccountResponse') },
          '400': { description: 'Validation error', content: json('ErrorResponse') },
          '401': unauthorized,
          '404': { description: 'Not found', content: json('ErrorResponse') },
        },
      },
    },
    '/v1/payments/sepay/webhook': {
      post: {
        operationId: 'sepayWebhook',
        summary: 'SePay incoming-transfer webhook. Header `Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>`. Idempotent per SePay transaction id; funds the order once its escrow holds the price.',
        requestBody: { required: true, content: json('SepayWebhook') },
        responses: { '200': { description: 'Recorded (or ignored: outgoing / other account)', content: { 'application/json': { schema: { type: 'object', properties: { success: { const: true } } } } } }, '400': { description: 'Validation error' }, '401': { description: 'Bad API key' } },
      },
    },
    '/v1/payments/dev-deposit': {
      post: {
        operationId: 'devDeposit',
        summary: 'Local development only (AUTH_DEV_LOGIN=true): the order customer simulates a transfer of the amount still due.',
        requestBody: { required: true, content: json('DevDeposit') },
        responses: { '200': { description: 'OK', content: json('PaymentInstructions') }, '404': { description: 'Disabled or order not found' } },
      },
    },
    '/v1/me/wallet': {
      get: { operationId: 'getWallet', summary: 'Coder earnings from the escrow ledger.', responses: { '200': { description: 'OK', content: json('Wallet') }, '401': unauthorized } },
    },
    '/v1/me/offers': {
      get: {
        operationId: 'listMyOffers',
        summary: 'Coder: open wave offers (PENDING, unexpired). Polling it is the presence heartbeat while online.',
        responses: { '200': { description: 'OK', content: json('OfferList') }, '401': unauthorized, '403': { description: 'Missing CODER role', content: json('ErrorResponse') } },
      },
    },
    '/v1/me/payouts': {
      get: { operationId: 'listMyPayouts', summary: 'Coder: own withdrawal requests.', responses: { '200': { description: 'OK', content: json('PayoutList') }, '401': unauthorized } },
      post: {
        operationId: 'requestPayout',
        summary: 'Coder: ask to withdraw wallet money to a bank account. An admin pays it by hand, then approves.',
        requestBody: { required: true, content: json('PayoutCreate') },
        responses: {
          '201': { description: 'Created (PENDING)', content: json('Payout') },
          '400': { description: 'Invalid body', content: json('ErrorResponse') },
          '401': unauthorized,
          '403': { description: 'Missing CODER role', content: json('ErrorResponse') },
          '409': { description: 'Amount exceeds wallet balance minus pending requests', content: json('ErrorResponse') },
        },
      },
    },
    '/v1/admin/coders': {
      get: { operationId: 'adminListCoders', summary: 'Admin: every coder with tier, suspension and wallet.', responses: { '200': { description: 'OK', content: json('AdminCoderList') }, '401': unauthorized, '403': adminOnly } },
    },
    '/v1/admin/coders/{id}': {
      patch: {
        operationId: 'adminUpdateCoder',
        summary: 'Admin: override tier and/or suspend (suspended coders get no offers).',
        parameters: [userId],
        requestBody: { required: true, content: json('AdminCoderPatch') },
        responses: { '200': { description: 'OK', content: json('AdminCoder') }, '400': { description: 'Invalid body', content: json('ErrorResponse') }, '401': unauthorized, '403': adminOnly, '404': notFound },
      },
    },
    '/v1/admin/orders': {
      get: {
        operationId: 'adminListOrders',
        summary: 'Admin: view=attention (default) = unpaid drafts waiting for a transfer, disputes, money left in escrow, paid orders nobody took for 30+ min; view=all = latest 200 orders.',
        parameters: [{ name: 'view', in: 'query', required: false, schema: { type: 'string', enum: ['attention', 'all'] } }],
        responses: { '200': { description: 'OK', content: json('AdminOrderList') }, '401': unauthorized, '403': adminOnly },
      },
    },
    '/v1/admin/orders/{id}': {
      get: {
        operationId: 'adminGetOrder',
        summary: 'Admin, read only: prompt, brief (milestones, links, notes), dispute reason, refund account, chat and ledger of one order.',
        parameters: [orderId],
        responses: { '200': { description: 'OK', content: json('AdminOrderDetail') }, '401': unauthorized, '403': adminOnly, '404': notFound },
      },
    },
    '/v1/admin/orders/{id}/confirm-payment': {
      post: {
        operationId: 'adminConfirmPayment',
        summary: 'Admin: book a bank transfer seen in the bank app onto a DRAFT order. Funds (and dispatches) the order once escrow holds the price. Same reference twice = 409.',
        parameters: [orderId],
        requestBody: { required: true, content: json('ConfirmPayment') },
        responses: { '200': { description: 'OK', content: json('AdminOrder') }, '400': { description: 'Invalid body', content: json('ErrorResponse') }, '401': unauthorized, '403': adminOnly, '404': notFound, '409': { description: 'Order not DRAFT, or reference already booked', content: json('ErrorResponse') } },
      },
    },
    '/v1/admin/orders/{id}/quote': {
      post: {
        operationId: 'adminQuoteOrder',
        summary: 'Admin: set the final price and delivery days of a DRAFT order (never below what was already paid). The customer sees the payment QR only after this. Funds the order if escrow already holds the price.',
        parameters: [orderId],
        requestBody: { required: true, content: json('OrderQuote') },
        responses: { '200': { description: 'OK', content: json('AdminOrder') }, '400': { description: 'Invalid body or price below the amount paid', content: json('ErrorResponse') }, '401': unauthorized, '403': adminOnly, '404': notFound, '409': { description: 'Order not DRAFT', content: json('ErrorResponse') } },
      },
    },
    '/v1/admin/orders/{id}/resolve': {
      post: {
        operationId: 'adminResolveDispute',
        summary: 'Admin: DISPUTED -> RESOLVED. refundVnd goes back to the customer, the rest of the escrow is released (coder share + platform fee).',
        parameters: [orderId],
        requestBody: { required: true, content: json('DisputeResolve') },
        responses: { '200': { description: 'OK', content: json('AdminOrder') }, '400': { description: 'Invalid body or refund above escrow', content: json('ErrorResponse') }, '401': unauthorized, '403': adminOnly, '404': notFound, '409': { description: 'Order not DISPUTED', content: json('ErrorResponse') } },
      },
    },
    '/v1/admin/orders/{id}/refund': {
      post: {
        operationId: 'adminRefundOrder',
        summary: 'Admin: refund what escrow still holds. DRAFT, or FUNDED/DISPATCHED with no coder yet -> CANCELLED (open offers expire); on ACCEPTED/RESOLVED/CANCELLED refunds the overpayment.',
        parameters: [orderId],
        responses: { '200': { description: 'OK', content: json('AdminOrder') }, '401': unauthorized, '403': adminOnly, '404': notFound, '409': { description: 'Order in progress or escrow empty', content: json('ErrorResponse') } },
      },
    },
    '/v1/admin/refunds': {
      get: {
        operationId: 'adminListRefunds',
        summary: 'Admin: refunds booked in the ledger to transfer by hand. status=PENDING (default) or all (latest 200).',
        parameters: [{ name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['PENDING', 'all'] } }],
        responses: { '200': { description: 'OK', content: json('RefundList') }, '401': unauthorized, '403': adminOnly },
      },
    },
    '/v1/admin/refunds/{id}/paid': {
      post: {
        operationId: 'adminMarkRefundPaid',
        summary: 'Admin: the refund was transferred; closes it with the bank reference. A reference closes one refund only.',
        parameters: [userId],
        requestBody: { required: true, content: json('RefundPaid') },
        responses: {
          '200': { description: 'OK', content: json('Refund') },
          '400': { description: 'Invalid body', content: json('ErrorResponse') },
          '401': unauthorized,
          '403': adminOnly,
          '404': notFound,
          '409': { description: 'Already PAID, or reference already used', content: json('ErrorResponse') },
        },
      },
    },
    '/v1/admin/suspense': {
      get: { operationId: 'adminListSuspense', summary: 'Admin: deposits that matched no order and are not reconciled yet.', responses: { '200': { description: 'OK', content: json('SuspenseList') }, '401': unauthorized, '403': adminOnly } },
    },
    '/v1/admin/suspense/{txId}/resolve': {
      post: {
        operationId: 'adminResolveSuspense',
        summary: 'Admin: move a suspense deposit onto an order (may fund it) or refund it. Once per deposit.',
        parameters: [{ name: 'txId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: json('SuspenseResolve') },
        responses: { '204': { description: 'Done' }, '400': { description: 'Invalid body', content: json('ErrorResponse') }, '401': unauthorized, '403': adminOnly, '404': notFound, '409': { description: 'Already reconciled', content: json('ErrorResponse') } },
      },
    },
    '/v1/admin/payouts': {
      get: { operationId: 'adminListPayouts', summary: 'Admin: withdrawal requests, PENDING first.', responses: { '200': { description: 'OK', content: json('PayoutList') }, '401': unauthorized, '403': adminOnly } },
    },
    '/v1/admin/payouts/{id}/decide': {
      post: {
        operationId: 'adminDecidePayout',
        summary: 'Admin: approve (money already sent; the wallet is debited in the ledger) or reject.',
        parameters: [userId],
        requestBody: { required: true, content: json('PayoutDecision') },
        responses: { '200': { description: 'OK', content: json('Payout') }, '400': { description: 'Invalid body', content: json('ErrorResponse') }, '401': unauthorized, '403': adminOnly, '404': notFound, '409': { description: 'Not PENDING, or wallet too low', content: json('ErrorResponse') } },
      },
    },
    '/v1/admin/monitor': {
      get: { operationId: 'adminMonitor', summary: 'Admin: outbox backlog, FAILED jobs, JetStream consumer lag.', responses: { '200': { description: 'OK', content: json('Monitor') }, '401': unauthorized, '403': adminOnly } },
    },
    '/v1/admin/jobs/repo/{id}/retry': {
      post: {
        operationId: 'adminRetryRepo',
        summary: 'Admin: re-queue the FAILED repo job of the order.',
        parameters: [orderId],
        responses: { '204': { description: 'Re-queued' }, '401': unauthorized, '403': adminOnly, '404': notFound, '409': { description: 'Repo job not FAILED', content: json('ErrorResponse') } },
      },
    },
    '/v1/admin/jobs/sandbox/{id}/retry': {
      post: {
        operationId: 'adminRetrySandbox',
        summary: 'Admin: re-deploy the FAILED sandbox preview of the order (last submitted commit).',
        parameters: [orderId],
        responses: { '204': { description: 'Re-queued' }, '401': unauthorized, '403': adminOnly, '404': notFound, '409': { description: 'Sandbox not FAILED, or repo not READY', content: json('ErrorResponse') } },
      },
    },
    '/v1/me/presence': {
      get: { operationId: 'getPresence', summary: 'Coder online toggle.', responses: { '200': { description: 'OK', content: json('Presence') }, '401': unauthorized } },
      put: {
        operationId: 'setPresence',
        summary: 'Coder goes online/offline. Offline coders get no new waves.',
        requestBody: { required: true, content: json('Presence') },
        responses: { '200': { description: 'OK', content: json('Presence') }, '401': unauthorized, '403': { description: 'Missing CODER role', content: json('ErrorResponse') } },
      },
    },
    '/v1/jobs': {
      get: {
        operationId: 'listJobs',
        summary: 'Coder: job board of paid orders no coder has taken yet (oldest first, own orders excluded).',
        responses: { '200': { description: 'OK', content: json('JobList') }, '401': unauthorized, '403': { description: 'Missing CODER role or suspended', content: json('ErrorResponse') } },
      },
    },
    '/v1/jobs/{id}/claim': {
      post: {
        operationId: 'claimJob',
        summary: 'Coder takes a job from the board: the order moves to IN_PROGRESS and open wave offers become LOST. One active order per coder.',
        parameters: [orderId],
        responses: {
          '200': { description: 'OK', content: json('Order') },
          '401': unauthorized,
          '403': { description: 'Missing CODER role or suspended', content: json('ErrorResponse') },
          '404': notFound,
          '409': { description: 'Already taken, not paid yet, or the coder already has an order in progress', content: json('ErrorResponse') },
        },
      },
    },
    '/v1/offers/{id}/accept': {
      post: {
        operationId: 'acceptOffer',
        summary: 'Coder accepts their offer. First accept wins: the order moves to IN_PROGRESS and the other offers become LOST.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'OK', content: json('Order') },
          '401': unauthorized,
          '404': { description: 'Not your offer', content: json('ErrorResponse') },
          '409': { description: 'Offer expired, declined or taken by another coder', content: json('ErrorResponse') },
        },
      },
    },
    '/v1/offers/{id}/decline': {
      post: {
        operationId: 'declineOffer',
        summary: 'Coder declines; they are not offered this order again.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '204': { description: 'Declined (no-op if no longer pending)' }, '401': unauthorized, '404': { description: 'Not your offer', content: json('ErrorResponse') } },
      },
    },
    '/v1/github/webhook': {
      post: {
        operationId: 'githubWebhook',
        summary: 'GitHub App webhook (push events). Verified with X-Hub-Signature-256 (GITHUB_APP_WEBHOOK_SECRET).',
        responses: { '204': { description: 'Accepted' }, '401': { description: 'Bad signature' } },
      },
    },
  },
  components: {
    securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'gc_session' } },
    schemas: {
      Me: schema(MeSchema),
      UpdateMe: schema(UpdateMeSchema, 'input'),
      AuthProviders: schema(AuthProvidersSchema),
      DevLogin: schema(DevLoginSchema, 'input'),
      Register: schema(RegisterSchema, 'input'),
      PasswordLogin: schema(PasswordLoginSchema, 'input'),
      AddRole: schema(AddRoleSchema, 'input'),
      CoderProfileDetails: schema(CoderProfileDetailsSchema, 'input'),
      CustomerProfile: schema(CustomerProfileSchema, 'input'),
      ChangePassword: schema(ChangePasswordSchema, 'input'),
      PushSubscription: schema(PushSubscriptionSchema, 'input'),
      PushUnsubscribe: schema(PushUnsubscribeSchema, 'input'),
      PushKey: schema(PushKeySchema),
      AIBrief: schema(AIBriefSchema),
      BriefJobCreate: schema(BriefJobCreateSchema, 'input'),
      BriefJob: schema(BriefJobSchema),
      ErrorResponse: schema(ErrorResponseSchema),
      RepoCreate: schema(RepoCreateSchema, 'input'),
      RepoHandover: schema(RepoHandoverSchema, 'input'),
      OrderRepo: schema(OrderRepoSchema),
      OrderCreate: schema(OrderCreateSchema, 'input'),
      Order: schema(OrderSchema),
      OrderList: schema(OrderListSchema),
      OrderTransition: schema(OrderTransitionSchema, 'input'),
      MilestoneSubmit: schema(MilestoneSubmitSchema, 'input'),
      MilestoneReject: schema(MilestoneRejectSchema, 'input'),
      RefundAccount: schema(RefundAccountSchema, 'input'),
      RefundAccountResponse: schema(RefundAccountResponseSchema),
      PaymentInstructions: schema(PaymentInstructionsSchema),
      SepayWebhook: schema(SepayWebhookSchema, 'input'),
      DevDeposit: schema(DevDepositSchema, 'input'),
      Wallet: schema(WalletSchema),
      OfferList: schema(OfferListSchema),
      JobList: schema(JobListSchema),
      Presence: schema(PresenceSchema),
      ChatMessage: schema(ChatMessageSchema),
      ChatSend: schema(ChatSendSchema, 'input'),
      ChatList: schema(ChatListSchema),
      RealtimeToken: schema(RealtimeTokenSchema),
      RealtimeHint: schema(RealtimeHintSchema),
      AdminCoder: schema(AdminCoderSchema),
      AdminCoderList: schema(AdminCoderListSchema),
      AdminCoderPatch: schema(AdminCoderPatchSchema, 'input'),
      AdminOrder: schema(AdminOrderSchema),
      AdminOrderList: schema(AdminOrderListSchema),
      AdminOrderDetail: schema(AdminOrderDetailSchema),
      Refund: schema(RefundSchema),
      RefundList: schema(RefundListSchema),
      RefundPaid: schema(RefundPaidSchema, 'input'),
      DisputeResolve: schema(DisputeResolveSchema, 'input'),
      ConfirmPayment: schema(ConfirmPaymentSchema, 'input'),
      OrderQuote: schema(OrderQuoteSchema, 'input'),
      SuspenseList: schema(SuspenseListSchema),
      SuspenseResolve: schema(SuspenseResolveSchema, 'input'),
      Payout: schema(PayoutSchema),
      PayoutList: schema(PayoutListSchema),
      PayoutCreate: schema(PayoutCreateSchema, 'input'),
      PayoutDecision: schema(PayoutDecisionSchema, 'input'),
      Monitor: schema(MonitorSchema),
    },
  },
});

write('events/brief.requested.schema.json', schema(BriefRequestedEventSchema));
write('events/brief.generated.schema.json', schema(BriefGeneratedEventSchema));
write('events/brief.failed.schema.json', schema(BriefFailedEventSchema));
write('events/repo.requested.schema.json', schema(RepoRequestedEventSchema));
write('events/repo.provisioned.schema.json', schema(RepoProvisionedEventSchema));
write('events/repo.failed.schema.json', schema(RepoFailedEventSchema));
write('events/repo.handover.requested.schema.json', schema(RepoHandoverRequestedEventSchema));
write('events/repo.handed_over.schema.json', schema(RepoHandedOverEventSchema));
for (const subject of Object.values(ORDER_SUBJECTS)) write(`events/${subject}.schema.json`, schema(OrderEventSchema));
for (const subject of [SUBJECTS.ESCROW_DEPOSITED, SUBJECTS.ESCROW_RELEASED, SUBJECTS.ESCROW_REFUNDED, SUBJECTS.ESCROW_PAID_OUT]) write(`events/${subject}.schema.json`, schema(EscrowEventSchema));
for (const subject of [SUBJECTS.DISPATCH_REQUESTED, SUBJECTS.DISPATCH_OFFERED, SUBJECTS.DISPATCH_ACCEPTED, SUBJECTS.DISPATCH_EXPIRED]) write(`events/${subject}.schema.json`, schema(DispatchEventSchema));
for (const subject of [SUBJECTS.MILESTONE_SUBMITTED, SUBJECTS.MILESTONE_APPROVED, SUBJECTS.MILESTONE_REJECTED]) write(`events/${subject}.schema.json`, schema(MilestoneEventSchema));
write('events/qa.requested.schema.json', schema(QaRequestedEventSchema));
write('events/qa.completed.schema.json', schema(QaCompletedEventSchema));
write('events/deploy.requested.schema.json', schema(DeployRequestedEventSchema));
write('events/deploy.ready.schema.json', schema(DeployReadyEventSchema));
write('events/deploy.failed.schema.json', schema(DeployFailedEventSchema));
write('events/deploy.expired.schema.json', schema(DeployExpiredEventSchema));
write('events/chat.posted.schema.json', schema(ChatPostedEventSchema));
write('events/payment.reported.schema.json', schema(PaymentReportedEventSchema));
write('events/payout.requested.schema.json', schema(PayoutRequestedEventSchema));
