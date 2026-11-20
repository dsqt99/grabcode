import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { and, count, eq, gt, ne, sql } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { coderTierFor, type ChangePassword, type PushSubscriptionInput, type CoderProfileDetails, type CustomerProfile, type Me, type OAuthProvider, type PasswordLogin, type Register, type UpdateMe, type AccountRole } from '@grabcode/contracts/schemas';
import { DB, type Db } from '../db/client';
import { coderProfiles, customerProfiles, orders, pushSubscriptions, sessions, userIdentities, users } from '../db/schema';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password';
import { Throttle } from './throttle';

export const SESSION_COOKIE = 'gc_session';
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

type UserRow = typeof users.$inferSelect;
export interface Identity {
  providerKey: string;
  githubLogin: string | null;
  email: string | null;
  name: string;
  avatarUrl: string | null;
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const addRoleSql = (role: AccountRole) =>
  sql`case when ${role}::text = any(${users.roles}) then ${users.roles} else array_append(${users.roles}, ${role}::text) end`;
/**
 * P0-8: a new coder waits for an admin; adding the role again keeps an earlier decision. Dev logins (AUTH_DEV_LOGIN, never in
 * production) are approved so local runs and smoke scripts can claim jobs.
 */
const isDev = (providerKey: string) => providerKey.startsWith('dev:');
const approvalFor = (role: AccountRole | undefined, providerKey: string) =>
  role !== 'CODER' ? {} : { coderApproval: isDev(providerKey) ? sql`'APPROVED'` : sql`coalesce(${users.coderApproval}, 'PENDING')` };

const toMe = (
  u: UserRow,
  coder: typeof coderProfiles.$inferSelect | undefined,
  customer: typeof customerProfiles.$inferSelect | undefined,
  accepted: number,
  linked: string[],
): Me => ({
  id: u.id,
  name: u.name,
  email: u.email,
  githubLogin: u.githubLogin,
  avatarUrl: u.avatarUrl,
  roles: u.roles,
  currency: u.currency,
  phone: u.phone,
  country: u.country,
  timezone: u.timezone,
  notifications: u.notifications,
  hasPassword: u.passwordHash !== null,
  loginMethod: u.providerKey.slice(0, u.providerKey.indexOf(':')) as Me['loginMethod'],
  linkedProviders: [u.providerKey, ...linked]
    .map((k) => k.slice(0, k.indexOf(':')))
    .filter((p): p is OAuthProvider => p === 'github' || p === 'google'),
  coderProfile: coder ? (({ userId, updatedAt, ...rest }) => rest)(coder) : null,
  customerProfile: customer ? { companyName: customer.companyName, companySize: customer.companySize, website: customer.website } : null,
  // rating stays null until customer reviews (S4).
  coderStats: u.roles.includes('CODER') ? { tier: u.tierOverride ?? coderTierFor(accepted), completedOrders: accepted, rating: null } : null,
  coderApproval: u.roles.includes('CODER') ? (u.coderApproval ?? 'PENDING') : null,
  createdAt: u.createdAt.toISOString(),
});

@Injectable()
export class AuthService {
  private readonly emailFails: Throttle;
  private readonly ipFails: Throttle;

  constructor(@Inject(DB) private readonly db: Db) {
    this.emailFails = new Throttle(db, 'login-email', 10, 15 * 60_000);
    this.ipFails = new Throttle(db, 'login-ip', 30, 15 * 60_000);
  }

  /** Me with both profiles loaded. */
  async me(user: UserRow): Promise<Me> {
    const [[coder], [customer], [stats], linked] = await Promise.all([
      this.db.select().from(coderProfiles).where(eq(coderProfiles.userId, user.id)),
      this.db.select().from(customerProfiles).where(eq(customerProfiles.userId, user.id)),
      this.db.select({ n: count() }).from(orders).where(and(eq(orders.coderUserId, user.id), eq(orders.status, 'ACCEPTED'))),
      this.db.select({ k: userIdentities.providerKey }).from(userIdentities).where(eq(userIdentities.userId, user.id)),
    ]);
    return toMe(user, coder, customer, stats?.n ?? 0, linked.map((r) => r.k));
  }

  /**
   * Upsert an OAuth/dev user and open a session. Returns the raw token.
   * Provider name/avatar only seed a NEW account, so edits made in settings survive the next login.
   */
  async login(id: Identity, role?: AccountRole): Promise<{ token: string; user: UserRow }> {
    const [linked] = await this.db.select({ userId: userIdentities.userId }).from(userIdentities).where(eq(userIdentities.providerKey, id.providerKey));
    if (linked) {
      const [user] = await this.db
        .update(users)
        .set({ ...(id.githubLogin ? { githubLogin: id.githubLogin } : {}), roles: role ? addRoleSql(role) : users.roles, ...approvalFor(role, id.providerKey), updatedAt: sql`now()` })
        .where(eq(users.id, linked.userId))
        .returning();
      return { token: await this.createSession(user.id), user };
    }
    const [user] = await this.db
      .insert(users)
      .values({ ...id, roles: role ? [role] : [], coderApproval: role !== 'CODER' ? null : isDev(id.providerKey) ? 'APPROVED' : 'PENDING' })
      .onConflictDoUpdate({
        target: users.providerKey,
        set: {
          githubLogin: id.githubLogin,
          email: id.email,
          roles: role ? addRoleSql(role) : users.roles,
          ...approvalFor(role, id.providerKey),
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return { token: await this.createSession(user.id), user };
  }

  /**
   * Attach an OAuth identity to the signed-in account: the user proved control of both, so no email matching is needed
   * (password emails are unverified, matching on them would let a squatter capture a later OAuth sign-up).
   * Never merges two existing accounts: an identity that already owns or is linked to another account is refused.
   */
  async link(user: UserRow, id: Identity): Promise<void> {
    const [owner] = await this.db.select({ id: users.id }).from(users).where(eq(users.providerKey, id.providerKey));
    if (owner && owner.id !== user.id) throw new ConflictException({ message: 'This login already has its own account' });
    if (owner) return;
    await this.db.transaction(async (tx) => {
      await tx.insert(userIdentities).values({ providerKey: id.providerKey, userId: user.id }).onConflictDoNothing();
      const [row] = await tx.select({ userId: userIdentities.userId }).from(userIdentities).where(eq(userIdentities.providerKey, id.providerKey));
      if (row.userId !== user.id) throw new ConflictException({ message: 'This login is linked to another account' });
      // A linked GitHub login is what repo invites and handover use.
      if (id.githubLogin) await tx.update(users).set({ githubLogin: id.githubLogin, updatedAt: sql`now()` }).where(eq(users.id, user.id));
    });
  }

  async addRole(userId: string, role: AccountRole): Promise<UserRow> {
    const [user] = await this.db
      .update(users)
      .set({ roles: addRoleSql(role), ...approvalFor(role, ''), updatedAt: sql`now()` })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async saveCoderProfile(user: UserRow, input: CoderProfileDetails): Promise<void> {
    if (!user.roles.includes('CODER')) throw new ForbiddenException({ message: 'Missing CODER role' });
    await this.db
      .insert(coderProfiles)
      .values({ userId: user.id, ...input })
      .onConflictDoUpdate({ target: coderProfiles.userId, set: { ...input, updatedAt: sql`now()` } });
  }

  async saveCustomerProfile(user: UserRow, input: CustomerProfile): Promise<void> {
    if (!user.roles.includes('CUSTOMER')) throw new ForbiddenException({ message: 'Missing CUSTOMER role' });
    await this.db
      .insert(customerProfiles)
      .values({ userId: user.id, ...input })
      .onConflictDoUpdate({ target: customerProfiles.userId, set: { ...input, updatedAt: sql`now()` } });
  }

  /** Verifies the current password, then revokes every other session (a leaked session dies with the old password). */
  async changePassword(user: UserRow, currentToken: string, input: ChangePassword): Promise<void> {
    if (!user.passwordHash) throw new BadRequestException({ message: 'Account has no password (OAuth login)' });
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException({ message: 'Wrong current password' });
    }
    await this.db.update(users).set({ passwordHash: await hashPassword(input.newPassword), updatedAt: sql`now()` }).where(eq(users.id, user.id));
    await this.db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.tokenHash, hash(currentToken))));
  }

  /** Upsert by endpoint: a browser shared by two accounts notifies whoever subscribed last. */
  async savePushSubscription(userId: string, s: PushSubscriptionInput): Promise<void> {
    const row = { userId, p256dh: s.keys.p256dh, auth: s.keys.auth };
    await this.db.insert(pushSubscriptions).values({ endpoint: s.endpoint, ...row }).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: row });
  }

  async deletePushSubscription(userId: string, endpoint: string): Promise<void> {
    await this.db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)));
  }

  /** Email/password sign-up; 409 if the email already has a password account. */
  async register(input: Register): Promise<{ token: string; user: UserRow }> {
    const [user] = await this.db
      .insert(users)
      .values({
        providerKey: `email:${input.email}`,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        name: input.name,
        roles: [input.role],
        ...(input.role === 'CODER' ? { coderApproval: 'PENDING' as const } : {}),
      })
      .onConflictDoNothing({ target: users.providerKey })
      .returning();
    if (!user) throw new ConflictException({ message: 'Email already registered' });
    return { token: await this.createSession(user.id), user };
  }

  /**
   * Same 401 for unknown email and wrong password, so the response does not reveal which emails exist.
   * 10 failures per email or 30 per IP in 15 minutes -> 429 until the window ends. The attempt is counted atomically
   * before the password is checked (parallel guesses cannot all slip past), and given back on success.
   */
  async passwordLogin(input: PasswordLogin, ip = ''): Promise<{ token: string; user: UserRow }> {
    const keys = [`e:${input.email}`, `i:${ip}`];
    const [emailOver, ipOver] = await Promise.all([this.emailFails.hit(keys[0]), this.ipFails.hit(keys[1])]);
    if (emailOver || ipOver) throw new HttpException({ message: 'Too many failed attempts, retry later' }, HttpStatus.TOO_MANY_REQUESTS);
    const [row] = await this.db.select().from(users).where(eq(users.providerKey, `email:${input.email}`));
    const ok = await verifyPassword(input.password, row?.passwordHash ?? (await DUMMY_HASH));
    if (!row || !ok) throw new UnauthorizedException({ message: 'Wrong email or password' });
    if (row.suspended) throw new ForbiddenException({ message: 'Account suspended' });
    await Promise.all([this.emailFails.reset(keys[0]), this.ipFails.undo(keys[1])]);
    const { email, githubLogin, name, avatarUrl, providerKey } = row;
    return this.login({ providerKey, email, githubLogin, name, avatarUrl });
  }

  private async createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.db.insert(sessions).values({
      tokenHash: hash(token),
      userId,
      expiresAt: sql`now() + make_interval(secs => ${SESSION_TTL_MS / 1000})`,
    });
    return token;
  }

  async userForToken(token: string | undefined): Promise<UserRow | undefined> {
    if (!token) return undefined;
    const [row] = await this.db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, hash(token)), gt(sessions.expiresAt, sql`now()`)));
    return row?.user;
  }

  async requireUser(token: string | undefined): Promise<UserRow> {
    const user = await this.userForToken(token);
    if (!user) throw new UnauthorizedException({ message: 'Not signed in' });
    // Suspended by an admin: no API access at all (their sessions are also deleted on suspension).
    if (user.suspended) throw new ForbiddenException({ message: 'Account suspended' });
    return user;
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.db.delete(sessions).where(eq(sessions.tokenHash, hash(token)));
  }

  async update(userId: string, patch: UpdateMe): Promise<UserRow> {
    const [user] = await this.db
      .update(users)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }
}
