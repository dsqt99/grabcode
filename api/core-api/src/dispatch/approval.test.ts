import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AdminService } from '../admin/admin.service';
import { AuthService } from '../auth/auth.service';
import { dispatchOffers, orders, users } from '../db/schema';
import { OrdersService } from '../orders/orders.service';
import type { ReposService } from '../repos/repos.service';
import { addOrder, addUser, testDb } from '../test/pglite';
import { DispatchService } from './dispatch.service';

// P0-8: a coder the admin has not approved sees no job board or offers and cannot claim / accept (403).

const setup = async () => {
  const db = await testDb();
  const ordersSvc = new OrdersService(db);
  const customer = await addUser(db, ['CUSTOMER']);
  return { db, auth: new AuthService(db), admin: new AdminService(db, {} as ReposService), dispatch: new DispatchService(db, ordersSvc), customer };
};

const forbidden = (p: Promise<unknown>) => assert.rejects(p, (e) => e instanceof ForbiddenException);

test('adding the CODER role starts PENDING; registering as a coder too; dev logins are approved', async () => {
  const { db, auth, customer } = await setup();
  assert.equal((await auth.me(customer)).coderApproval, null, 'not a coder');
  const added = await auth.addRole(customer.id, 'CODER');
  assert.equal(added.coderApproval, 'PENDING');
  assert.equal((await auth.me(added)).coderApproval, 'PENDING');

  const { user: reg } = await auth.register({ email: 'coder@example.vn', password: 'mat-khau-dai', name: 'An', role: 'CODER' });
  assert.equal(reg.coderApproval, 'PENDING');
  const { user: oauth } = await auth.login({ providerKey: 'github:42', githubLogin: 'an', email: null, name: 'An', avatarUrl: null }, 'CODER');
  assert.equal(oauth.coderApproval, 'PENDING');
  const { user: dev } = await auth.login({ providerKey: 'dev:binh', githubLogin: 'binh', email: null, name: 'binh', avatarUrl: null }, 'CODER');
  assert.equal(dev.coderApproval, 'APPROVED');

  // A rejected coder who adds the role again stays rejected.
  await db.update(users).set({ coderApproval: 'REJECTED' }).where(eq(users.id, customer.id));
  assert.equal((await auth.addRole(customer.id, 'CODER')).coderApproval, 'REJECTED');
});

test('pending coder: jobs, offers, presence, claim and accept are 403; approved by an admin they work', async () => {
  const { db, auth, admin, dispatch, customer } = await setup();
  const coder = await auth.addRole((await addUser(db, ['CUSTOMER'], 'coder')).id, 'CODER');
  const o = await addOrder(db, customer.id, { status: 'FUNDED', fundedAt: new Date() });
  const [offer] = await db
    .insert(dispatchOffers)
    .values({ orderId: o.id, coderUserId: coder.id, wave: 1, expiresAt: new Date(Date.now() + 60_000) })
    .returning();

  await forbidden(dispatch.jobs(coder));
  await forbidden(dispatch.offers(coder));
  await forbidden(dispatch.setPresence(coder, true));
  await forbidden(dispatch.claim(coder, o.id));
  await forbidden(dispatch.accept(coder, offer.id));

  const [listed] = await admin.coders();
  assert.equal(listed.approval, 'PENDING', 'pending applications listed first');
  const approved = await admin.patchCoder(coder.id, { approval: 'APPROVED' });
  assert.equal(approved.approval, 'APPROVED');

  const [fresh] = await db.select().from(users).where(eq(users.id, coder.id));
  assert.deepEqual((await dispatch.jobs(fresh)).map((j) => j.id), [o.id]);
  assert.equal((await dispatch.claim(fresh, o.id)).status, 'IN_PROGRESS');
});

test('rejected coder is 403 and goes offline; waves only reach approved coders', async () => {
  const { db, auth, admin, dispatch, customer } = await setup();
  const pending = await auth.addRole((await addUser(db, ['CUSTOMER'], 'p')).id, 'CODER');
  const approved = await auth.addRole((await addUser(db, ['CUSTOMER'], 'a')).id, 'CODER');
  await admin.patchCoder(approved.id, { approval: 'APPROVED' });
  // Both look online (the pending one could have been online before this change).
  await db.update(users).set({ online: true, lastSeenAt: new Date() });
  const o = await addOrder(db, customer.id, { status: 'FUNDED', fundedAt: new Date() });

  await dispatch.sendWave(o.id);
  const offered = await db.select({ coder: dispatchOffers.coderUserId }).from(dispatchOffers).where(eq(dispatchOffers.orderId, o.id));
  assert.deepEqual(offered.map((r) => r.coder), [approved.id]);
  const [row] = await db.select().from(orders).where(eq(orders.id, o.id));
  assert.equal(row.status, 'DISPATCHED');

  await admin.patchCoder(pending.id, { approval: 'REJECTED' });
  const [rejected] = await db.select().from(users).where(eq(users.id, pending.id));
  assert.equal(rejected.online, false);
  await forbidden(dispatch.jobs(rejected));
});

test('admin coder list shows the application: profile and phone', async () => {
  const { db, auth, admin } = await setup();
  const coder = await auth.addRole((await addUser(db, ['CUSTOMER'], 'c')).id, 'CODER');
  await auth.update(coder.id, { phone: '0912345678' });
  await auth.saveCoderProfile(coder, {
    headline: 'Vibe coder Next.js',
    bio: 'Làm web bán hàng',
    hourlyRateVnd: 200_000,
    experienceLevel: 'INTERMEDIATE',
    skills: ['Next.js'],
    hoursPerWeek: 'H10_30',
    languages: [],
    githubUrl: 'https://github.com/c',
    portfolioUrls: ['https://c.example.vn'],
    isPublic: true,
    availableForWork: true,
  });
  const [c] = await admin.coders();
  assert.equal(c.phone, '0912345678');
  assert.deepEqual(c.profile, {
    headline: 'Vibe coder Next.js',
    bio: 'Làm web bán hàng',
    skills: ['Next.js'],
    experienceLevel: 'INTERMEDIATE',
    githubUrl: 'https://github.com/c',
    portfolioUrls: ['https://c.example.vn'],
  });
});
