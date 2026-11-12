import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { and, count, eq, gt, ne, sql } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { coderTierFor, type ChangePassword, type CoderProfileDetails, type CustomerProfile, type Me, type PasswordLogin, type Register, type UpdateMe, type AccountRole } from '@grabcode/contracts/schemas';
import { DB, type Db } from '../db/client';
import { coderProfiles, customerProfiles, orders, sessions, users } from '../db/schema';
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

const toMe = (
  u: UserRow,
  coder: typeof coderProfiles.$inferSelect | undefined,
  customer: typeof customerProfiles.$inferSelect | undefined,
  accepted: number,
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
  coderProfile: coder ? (({ userId, updatedAt, ...rest }) => rest)(coder) : null,
  customerProfile: customer ? { companyName: customer.companyName, companySize: customer.companySize, website: customer.website } : null,
  // rating stays null until customer reviews (S4).
  coderStats: u.roles.includes('CODER') ? { tier: u.tierOverride ?? coderTierFor(accepted), completedOrders: accepted, rating: null } : null,
  createdAt: u.createdAt.toISOString(),
});

@Injectable()
export class AuthService {
  private readonly emailFails = new Throttle(10, 15 * 60_000);
  private readonly ipFails = new Throttle(30, 15 * 60_000);

  constructor(@Inject(DB) private readonly db: Db) {}

  /** Me with both profiles loaded. */
  async me(user: UserRow): Promise<Me> {
    const [[coder], [customer], [stats]] = await Promise.all([
      this.db.select().from(coderProfiles).where(eq(coderProfiles.userId, user.id)),
      this.db.select().from(customerProfiles).where(eq(customerProfiles.userId, user.id)),
      this.db.select({ n: count() }).from(orders).where(and(eq(orders.coderUserId, user.id), eq(orders.status, 'ACCEPTED'))),
    ]);
    return toMe(user, coder, customer, stats?.n ?? 0);
  }

  /**
   * Upsert an OAuth/dev user and open a session. Returns the raw token.
   * Provider name/avatar only seed a NEW account, so edits made in settings survive the next login.
   */
  async login(id: Identity, role?: AccountRole): Promise<{ token: string; user: UserRow }> {
    const [user] = await this.db
      .insert(users)
      .values({ ...id, roles: role ? [role] : [] })
      .onConflictDoUpdate({
        target: users.providerKey,
        set: {
          githubLogin: id.githubLogin,
          email: id.email,
          roles: role ? addRoleSql(role) : users.roles,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return { token: await this.createSession(user.id), user };
  }

  async addRole(userId: string, role: AccountRole): Promise<UserRow> {
    const [user] = await this.db.update(users).set({ roles: addRoleSql(role), updatedAt: sql`now()` }).where(eq(users.id, userId)).returning();
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
      })
      .onConflictDoNothing({ target: users.providerKey })
      .returning();
    if (!user) throw new ConflictException({ message: 'Email already registered' });
    return { token: await this.createSession(user.id), user };
  }

  /**
   * Same 401 for unknown email and wrong password, so the response does not reveal which emails exist.
   * 10 failures per email or 30 per IP in 15 minutes -> 429 until the window ends (checked before the password).
   */
  async passwordLogin(input: PasswordLogin, ip = ''): Promise<{ token: string; user: UserRow }> {
    const keys = [`e:${input.email}`, `i:${ip}`];
    if (this.emailFails.blocked(keys[0]) || this.ipFails.blocked(keys[1]))
      throw new HttpException({ message: 'Too many failed attempts, retry later' }, HttpStatus.TOO_MANY_REQUESTS);
    const [row] = await this.db.select().from(users).where(eq(users.providerKey, `email:${input.email}`));
    const ok = await verifyPassword(input.password, row?.passwordHash ?? (await DUMMY_HASH));
    if (!row || !ok) {
      this.emailFails.fail(keys[0]);
      this.ipFails.fail(keys[1]);
      throw new UnauthorizedException({ message: 'Wrong email or password' });
    }
    this.emailFails.reset(keys[0]);
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
