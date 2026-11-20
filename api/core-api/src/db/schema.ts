import { sql } from 'drizzle-orm';
import { bigint, bigserial, boolean, index, integer, jsonb, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { AIBrief } from '@grabcode/contracts';
import type { CoderProfileDetails, NotificationPrefs, RefundAccount, Sandbox } from '@grabcode/contracts/schemas';

export const core = pgSchema('core');

export const briefJobs = core.table('brief_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: text('status', { enum: ['PENDING', 'READY', 'FAILED'] }).notNull().default('PENDING'),
  prompt: text('prompt').notNull(),
  tier: text('tier', { enum: ['EXPRESS', 'STANDARD', 'PRO', 'TEMPLATE'] }).notNull(),
  templateId: text('template_id'),
  framework: text('framework').notNull(),
  brief: jsonb('brief').$type<AIBrief>(),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Transactional outbox: written in the same tx as the business row, drained by workers/outbox-relay.
export const outbox = core.table('outbox', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  eventId: uuid('event_id').notNull().unique(),
  subject: text('subject').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
});

export const users = core.table('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // 'github:<id>' | 'google:<sub>' | 'email:<lowercased email>' | 'dev:<login>'; stable across profile renames.
  // Further OAuth logins of the same person live in user_identities (linked explicitly while signed in, never by email).
  providerKey: text('provider_key').notNull().unique(),
  githubLogin: text('github_login'),
  email: text('email'),
  // scrypt$<salt b64>$<hash b64>; only for email/password accounts.
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  // ADMIN is never self-service: granted by SQL (or dev-login when AUTH_DEV_LOGIN=true).
  roles: text('roles', { enum: ['CUSTOMER', 'CODER', 'ADMIN'] }).array().notNull(),
  currency: text('currency', { enum: ['VND', 'USD'] }).notNull().default('VND'),
  phone: text('phone'),
  country: text('country').notNull().default('VN'),
  timezone: text('timezone').notNull().default('Asia/Ho_Chi_Minh'),
  notifications: jsonb('notifications').$type<NotificationPrefs>().notNull().default({ email: true, zalo: true, push: true }),
  // Coder presence: online toggle + last GET /v1/me/offers poll (heartbeat). Matching only offers to fresh online coders.
  online: boolean('online').notNull().default(false),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  // S7 admin: tier override (null = computed from accepted orders); suspended coders get no offers.
  tierOverride: text('tier_override', { enum: ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'] }),
  suspended: boolean('suspended').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Only the SHA-256 of the session token is stored, so a DB leak does not leak live sessions.
/** Extra OAuth identities linked to an account from /profile; a providerKey is either a users row or here, never both. */
export const userIdentities = core.table('user_identities', {
  providerKey: text('provider_key').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Fixed-window attempt counters (login failures, public brief requests) shared by all core-api replicas. */
export const rateLimits = core.table('rate_limits', {
  key: text('key').primaryKey(),
  n: integer('n').notNull(),
  until: timestamp('until', { withTimezone: true }).notNull(),
});

export const sessions = core.table('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** WebPush endpoints per browser; notifier reads them and deletes ones the push service reports gone (404/410). */
export const pushSubscriptions = core.table('push_subscriptions', {
  endpoint: text('endpoint').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Typed columns (not one jsonb blob) so the matching engine can filter on skills/rate/availability.
export const coderProfiles = core.table('coder_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  headline: text('headline').notNull(),
  bio: text('bio').notNull(),
  hourlyRateVnd: integer('hourly_rate_vnd').notNull(),
  experienceLevel: text('experience_level', { enum: ['ENTRY', 'INTERMEDIATE', 'EXPERT'] }).notNull(),
  skills: text('skills').array().notNull(),
  hoursPerWeek: text('hours_per_week', { enum: ['LT_10', 'H10_30', 'GT_30'] }).notNull(),
  languages: jsonb('languages').$type<CoderProfileDetails['languages']>().notNull(),
  githubUrl: text('github_url'),
  portfolioUrls: text('portfolio_urls').array().notNull(),
  isPublic: boolean('is_public').notNull(),
  availableForWork: boolean('available_for_work').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const customerProfiles = core.table('customer_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull(),
  companySize: text('company_size', { enum: ['SOLO', 'S2_10', 'S11_50', 'S51_200', 'S200_PLUS'] }).notNull(),
  website: text('website'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orderNumberSeq = core.sequence('order_number_seq', { startWith: 1001 });

// Order core (S1). Milestones live inside brief.milestones (status per milestone); a submissions table comes with S4.
export const orders = core.table(
  'orders',
  {
    id: text('id').primaryKey().default(sql`'GC-' || nextval('core.order_number_seq')`),
    customerUserId: uuid('customer_user_id')
      .notNull()
      .references(() => users.id),
    coderUserId: uuid('coder_user_id').references(() => users.id),
    status: text('status', { enum: ['DRAFT', 'FUNDED', 'DISPATCHED', 'IN_PROGRESS', 'DELIVERED', 'ACCEPTED', 'DISPUTED', 'CANCELLED', 'RESOLVED'] }).notNull().default('DRAFT'),
    tier: text('tier', { enum: ['EXPRESS', 'STANDARD', 'PRO', 'TEMPLATE'] }).notNull(),
    title: text('title').notNull(),
    prompt: text('prompt').notNull(),
    templateId: text('template_id'),
    framework: text('framework').notNull(),
    brief: jsonb('brief').$type<AIBrief>().notNull(),
    priceVnd: integer('price_vnd').notNull(),
    /** Coder's total share, fixed at creation (CODER_PAYOUT_RATE then), so a rate change only affects new orders. */
    payoutVnd: integer('payout_vnd').notNull(),
    etaHours: integer('eta_hours').notNull(),
    disputeReason: text('dispute_reason'),
    /** DRAFT -> FUNDED time: the 30 min "no coder yet" and AUTO_REFUND_HOURS clocks start here (not createdAt). */
    fundedAt: timestamp('funded_at', { withTimezone: true }),
    /** Customer's bank account for refunds of this order (shown to admins on pending refunds, never to the coder). */
    refundAccount: jsonb('refund_account').$type<RefundAccount>(),
    // Cloud Run preview (S5), written from deploy-worker results.
    sandbox: jsonb('sandbox').$type<Sandbox>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('orders_customer_idx').on(t.customerUserId), index('orders_coder_idx').on(t.coderUserId), index('orders_status_idx').on(t.status)],
);

// One private GitHub repo per order.
export const orderRepos = core.table('order_repos', {
  orderId: text('order_id')
    .primaryKey()
    .references(() => orders.id, { onDelete: 'cascade' }),
  coderUserId: uuid('coder_user_id')
    .notNull()
    .references(() => users.id),
  status: text('status', { enum: ['PENDING', 'READY', 'FAILED'] }).notNull().default('PENDING'),
  repoFullName: text('repo_full_name').unique(),
  htmlUrl: text('html_url'),
  cloneUrl: text('clone_url'),
  collaborator: text('collaborator'),
  error: text('error'),
  handedOverAt: timestamp('handed_over_at', { withTimezone: true }),
  handedOverTo: text('handed_over_to'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Commit timeline from the GitHub push webhook; sha PK makes webhook redeliveries no-ops.
export const repoCommits = core.table('repo_commits', {
  sha: text('sha').primaryKey(),
  orderId: text('order_id')
    .notNull()
    .references(() => orderRepos.orderId, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  author: text('author').notNull(),
  url: text('url').notNull(),
  pushedAt: timestamp('pushed_at', { withTimezone: true }).notNull(),
});

// Escrow ledger (double-entry). The tx id is the idempotency key: 'sepay:<SePay id>', 'release:<orderId>:<milestone>', 'dev:<uuid>',
// 'resolve:<orderId>', 'refund:<orderId>:<n>', 'suspense:<deposit tx id>', 'payout:<request id>'.
// Entries of one tx sum to 0 (checked before insert); an account balance is the sum of its entries.
export const ledgerTxs = core.table('ledger_txs', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['DEPOSIT', 'RELEASE', 'REFUND', 'PAYOUT', 'ADJUST'] }).notNull(),
  orderId: text('order_id').references(() => orders.id),
  /** Raw source (e.g. SePay webhook body) for reconciliation. */
  meta: jsonb('meta'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ledgerEntries = core.table(
  'ledger_entries',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    txId: text('tx_id')
      .notNull()
      .references(() => ledgerTxs.id),
    account: text('account').notNull(),
    amountVnd: bigint('amount_vnd', { mode: 'number' }).notNull(),
  },
  (t) => [index('ledger_entries_account_idx').on(t.account)],
);

// Wave offers (S3). One row per (order, coder, wave); the order row lock decides the single winner.
export const dispatchOffers = core.table(
  'dispatch_offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    coderUserId: uuid('coder_user_id')
      .notNull()
      .references(() => users.id),
    wave: integer('wave').notNull(),
    status: text('status', { enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'LOST'] }).notNull().default('PENDING'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('dispatch_offers_order_idx').on(t.orderId), index('dispatch_offers_coder_status_idx').on(t.coderUserId, t.status)],
);

// Order chat (S6) between the customer and the assigned coder. Inserts fire a `chat` realtime hint (migration trigger).
export const orderMessages = core.table(
  'order_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    senderUserId: uuid('sender_user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('order_messages_order_idx').on(t.orderId, t.createdAt)],
);

// Refunds to transfer by hand: one row per ledger tx that books money back to a customer (postTx opens it).
// The admin transfers the money and closes it with the bank reference (unique: one transfer closes one refund).
export const refunds = core.table(
  'refunds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    txId: text('tx_id')
      .notNull()
      .unique()
      .references(() => ledgerTxs.id),
    orderId: text('order_id').references(() => orders.id),
    amountVnd: bigint('amount_vnd', { mode: 'number' }).notNull(),
    status: text('status', { enum: ['PENDING', 'PAID'] }).notNull().default('PENDING'),
    reference: text('reference').unique(),
    paidBy: uuid('paid_by').references(() => users.id),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('refunds_status_idx').on(t.status, t.createdAt)],
);

// Coder withdrawals (S7). PENDING requests reserve wallet money; approval writes ledger tx 'payout:<id>'.
export const payoutRequests = core.table(
  'payout_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    coderUserId: uuid('coder_user_id')
      .notNull()
      .references(() => users.id),
    amountVnd: bigint('amount_vnd', { mode: 'number' }).notNull(),
    bankAccount: text('bank_account').notNull(),
    status: text('status', { enum: ['PENDING', 'PAID', 'REJECTED'] }).notNull().default('PENDING'),
    note: text('note'),
    decidedBy: uuid('decided_by').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('payout_requests_coder_idx').on(t.coderUserId, t.status)],
);
