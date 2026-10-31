import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import mongoose from 'mongoose';
import { spawnSync } from 'node:child_process';
import User from '../models/user.model.js';
import Goal from '../models/goal.model.js';
import VisionBoard from '../models/visionBoard.model.js';
import AreaOfLife from '../models/areaOfLife.model.js';
import { planSnapshot } from '../services/plan.service.js';
import { updateMySubscription, requireBillingTestMode } from '../controllers/user.controller.js';
import { updateSubscriptionSchema } from '../validations/user.validation.js';
import router from '../routes/user.routes.js';

const id = new mongoose.Types.ObjectId();
const past = () => new Date(Date.now() - 60_000);
const future = () => new Date(Date.now() + 86_400_000);
const user = (subscription) => User.hydrate(new User({
  _id: id, userName: 'Dreamer', email: 'dreamer@example.test', bio: 'My vision',
  subscription
}).toObject({ virtuals: false }));

beforeEach(() => {
  for (const model of [Goal, VisionBoard, AreaOfLife]) {
    mock.method(model, 'countDocuments', async () => 2);
  }
});
afterEach(() => {
  mock.restoreAll();
});

test('lock reasons reflect existing access resolution and omit reasons for limited/full access', async () => {
  const cases = [
    [{ tier: 'free', status: 'none' }, 'locked', 'never_started'],
    [{ tier: 'premium', status: 'trialing', trialEndsAt: past() }, 'locked', 'trial_ended'],
    [{ tier: 'premium', status: 'expired', trialEndsAt: past() }, 'locked', 'subscription_ended'],
    [{ tier: 'premium', status: 'active', expiresAt: past() }, 'locked', 'subscription_ended'],
    [{ tier: 'premium', status: 'trialing', trialEndsAt: future() }, 'limited', undefined],
    [{ tier: 'premium', status: 'active', expiresAt: future() }, 'full', undefined],
    [{ tier: 'premium', status: 'trialing', trialEndsAt: null }, 'locked', 'subscription_ended']
  ];
  for (const [subscription, access, reason] of cases) {
    const doc = user(subscription);
    const before = doc.toObject();
    const snapshot = await planSnapshot(doc);
    assert.equal(snapshot.accessLevel, access);
    assert.equal(snapshot.lockReason, reason);
    assert.equal(Object.hasOwn(snapshot, 'lockReason'), access === 'locked');
    assert.deepEqual(doc.toObject(), before, 'reading access/snapshot must not modify data');
    assert.equal(snapshot.usage.boards.used, 2);
  }
});

test('expireTrial accepts a flag-only payload while existing plan validation remains required', () => {
  assert.deepEqual(updateSubscriptionSchema.parse({ body: { expireTrial: true } }).body,
    { expireTrial: true });
  assert.equal(updateSubscriptionSchema.safeParse({ body: {} }).success, false);
  assert.equal(updateSubscriptionSchema.safeParse({ body: { expireTrial: false } }).success, false);
  assert.equal(updateSubscriptionSchema.safeParse({ body: { tier: 'premium' } }).success, false);
  assert.equal(updateSubscriptionSchema.safeParse({ body: { tier: 'free', status: 'none' } }).success, true);
  assert.equal(updateSubscriptionSchema.safeParse({ body: {
    tier: 'premium', status: 'trialing', billingPeriod: 'monthly'
  } }).success, true);
});

test('expireTrial changes only status/date, produces trial_ended and preserves saved profile and billing data', async () => {
  const doc = user({
    tier: 'premium', status: 'active', billingPeriod: 'annual', source: 'manual',
    startedAt: new Date('2025-01-01'), expiresAt: future()
  });
  const before = doc.toObject();
  mock.method(User, 'findById', async () => doc);
  const save = mock.method(doc, 'save', async () => doc);
  const start = Date.now();
  const response = await new Promise((resolve, reject) => {
    const req = { user: { _id: id }, ...updateSubscriptionSchema.parse({ body: { expireTrial: true } }) };
    updateMySubscription(req, { status() { return this; }, json: resolve }, reject);
  });
  assert.equal(save.mock.callCount(), 1);
  assert.equal(doc.subscription.status, 'trialing');
  const trialEnd = doc.subscription.trialEndsAt.getTime();
  assert.ok(trialEnd >= start - 60_000 && trialEnd <= Date.now() - 60_000);
  assert.equal(response.data.accessLevel, 'locked');
  assert.equal(response.data.lockReason, 'trial_ended');
  assert.deepEqual(Object.keys(doc.$getChanges().$set).sort(),
    ['subscription.status', 'subscription.trialEndsAt']);
  assert.equal(doc.bio, before.bio);
  assert.equal(doc.subscription.expiresAt.getTime(), before.subscription.expiresAt.getTime());
  assert.equal(doc.subscription.billingPeriod, 'annual');
});

test('PATCH remains authenticated and test-mode-gated before validation and update', async () => {
  const route = router.stack.find((layer) => layer.route?.path === '/me/subscription' && layer.route.methods.patch);
  const authError = await new Promise((resolve) => router.stack[0].handle({ headers: {} }, {}, resolve));
  assert.equal(authError.statusCode, 401);
  assert.equal(route.route.stack[0].handle, requireBillingTestMode);
  assert.equal(route.route.stack.at(-1).handle, updateMySubscription);
  for (const [flag, expected] of [['false', '403'], ['true', 'allowed']]) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { requireBillingTestMode } from './controllers/user.controller.js';
      requireBillingTestMode({}, {}, (error) => console.log(error?.statusCode || 'allowed'));
    `], { encoding: 'utf8', env: { ...process.env, BILLING_TEST_MODE: flag } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), expected);
  }
});
