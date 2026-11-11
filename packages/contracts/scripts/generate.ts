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
  SUBJECTS,
} from '../src/schemas/events.ts';
import { OfferListSchema, PresenceSchema } from '../src/schemas/dispatch.ts';
import { DevDepositSchema, PaymentInstructionsSchema, SepayWebhookSchema, WalletSchema } from '../src/schemas/payment.ts';
import {
  MilestoneCompleteSchema,
  OrderCreateSchema,
  OrderListSchema,
  OrderSchema,
  OrderTransitionSchema,
} from '../src/schemas/order.ts';
import { OrderRepoSchema, RepoCreateSchema } from '../src/schemas/repo.ts';
import {
  AddRoleSchema,
  AuthProvidersSchema,
  ChangePasswordSchema,
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
        summary: 'Browser navigation: redirects to the OAuth provider. `redirect` must be an allowed web origin URL.',
        parameters: [provider, role, { name: 'redirect', in: 'query', required: false, schema: { type: 'string', format: 'uri' } }],
        responses: { '302': { description: 'Redirect to provider' }, '404': { description: 'Provider not configured' } },
      },
    },
    '/v1/auth/{provider}/callback': {
      get: {
        operationId: 'oauthCallback',
        summary: 'Provider redirects here; sets the gc_session cookie and redirects back (adds ?auth_error=state|oauth on failure).',
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
        responses: { '200': { description: 'OK', content: json('Me') }, '401': { description: 'Wrong email or password', content: json('ErrorResponse') } },
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
        summary: 'Customer or assigned coder; a CODER may also read a DISPATCHED unassigned order.',
        parameters: [orderId],
        responses: { '200': { description: 'OK', content: json('Order') }, '401': unauthorized, '404': { description: 'Not found', content: json('ErrorResponse') } },
      },
    },
    '/v1/orders/{id}/transitions': {
      post: {
        operationId: 'transitionOrder',
        summary:
          'Move the order. IN_PROGRESS->DELIVERED (assigned coder, all milestones done), DELIVERED->ACCEPTED|DISPUTED|IN_PROGRESS (customer; ACCEPTED releases escrow to the coder). DRAFT->FUNDED (escrow holds the price), FUNDED->DISPATCHED (wave sent) and DISPATCHED->IN_PROGRESS (POST /v1/offers/{id}/accept) are taken by the server.',
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
    '/v1/orders/{id}/milestones/{milestoneId}/complete': {
      post: {
        operationId: 'completeMilestone',
        summary: 'Assigned coder marks the next pending milestone COMPLETED (in order) while IN_PROGRESS.',
        parameters: [orderId, { name: 'milestoneId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: false, content: json('MilestoneComplete') },
        responses: {
          '200': { description: 'OK', content: json('Order') },
          '401': unauthorized,
          '403': { description: 'Not the assigned coder', content: json('ErrorResponse') },
          '404': { description: 'Not found', content: json('ErrorResponse') },
          '409': { description: 'Order not IN_PROGRESS or milestone out of order', content: json('ErrorResponse') },
        },
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
    '/v1/me/presence': {
      get: { operationId: 'getPresence', summary: 'Coder online toggle.', responses: { '200': { description: 'OK', content: json('Presence') }, '401': unauthorized } },
      put: {
        operationId: 'setPresence',
        summary: 'Coder goes online/offline. Offline coders get no new waves.',
        requestBody: { required: true, content: json('Presence') },
        responses: { '200': { description: 'OK', content: json('Presence') }, '401': unauthorized, '403': { description: 'Missing CODER role', content: json('ErrorResponse') } },
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
      AIBrief: schema(AIBriefSchema),
      BriefJobCreate: schema(BriefJobCreateSchema, 'input'),
      BriefJob: schema(BriefJobSchema),
      ErrorResponse: schema(ErrorResponseSchema),
      RepoCreate: schema(RepoCreateSchema, 'input'),
      OrderRepo: schema(OrderRepoSchema),
      OrderCreate: schema(OrderCreateSchema, 'input'),
      Order: schema(OrderSchema),
      OrderList: schema(OrderListSchema),
      OrderTransition: schema(OrderTransitionSchema, 'input'),
      MilestoneComplete: schema(MilestoneCompleteSchema, 'input'),
      PaymentInstructions: schema(PaymentInstructionsSchema),
      SepayWebhook: schema(SepayWebhookSchema, 'input'),
      DevDeposit: schema(DevDepositSchema, 'input'),
      Wallet: schema(WalletSchema),
      OfferList: schema(OfferListSchema),
      Presence: schema(PresenceSchema),
    },
  },
});

write('events/brief.requested.schema.json', schema(BriefRequestedEventSchema));
write('events/brief.generated.schema.json', schema(BriefGeneratedEventSchema));
write('events/brief.failed.schema.json', schema(BriefFailedEventSchema));
write('events/repo.requested.schema.json', schema(RepoRequestedEventSchema));
write('events/repo.provisioned.schema.json', schema(RepoProvisionedEventSchema));
write('events/repo.failed.schema.json', schema(RepoFailedEventSchema));
for (const subject of Object.values(ORDER_SUBJECTS)) write(`events/${subject}.schema.json`, schema(OrderEventSchema));
for (const subject of [SUBJECTS.ESCROW_DEPOSITED, SUBJECTS.ESCROW_RELEASED]) write(`events/${subject}.schema.json`, schema(EscrowEventSchema));
for (const subject of [SUBJECTS.DISPATCH_REQUESTED, SUBJECTS.DISPATCH_OFFERED, SUBJECTS.DISPATCH_ACCEPTED, SUBJECTS.DISPATCH_EXPIRED]) write(`events/${subject}.schema.json`, schema(DispatchEventSchema));
