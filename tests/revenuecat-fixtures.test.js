// Network-free: no app boot, database connection, provider calls or credentials.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import {
  mapSubscriber, fetchSubscriber, createRevenueCatService,
  canRetainAccessDuringOutage
} from '../services/revenuecat.service.js';
import {
  createRevenueCatWebhookHandler, verifyWebhook, webhookUserIds
} from '../services/revenuecatWebhook.service.js';

process.env.BILLING_TEST_MODE = 'false';
const NOW = new Date('2026-11-13T12:00:00Z');
const PAST = '2026-11-12T12:00:00Z';
const FUTURE = '2026-12-13T12:00:00Z';
const USER_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439012';
const config = {
  apiKey: 'fixture-key', entitlementId: 'premium',
  monthlyProductIds: ['sku.m1'], annualProductIds: ['sku.a1']
};
const customer = ({ product = 'sku.m1', expiry = FUTURE, period = 'normal', ...details } = {}) => ({
  subscriber: {
    entitlements: { premium: { product_identifier: product, expires_date: expiry, purchase_date: PAST } },
    subscriptions: { [product]: {
      expires_date: expiry, period_type: period, store: 'app_store', is_sandbox: true,
      unsubscribe_detected_at: null, billing_issues_detected_at: null, ...details
    } }
  }
});

const cases = [
  ['trial active', { period: 'trial' }, { status: 'trialing', trialEndsAt: FUTURE, expiresAt: null }],
  ['trial lapsed', { period: 'trial', expiry: PAST }, { status: 'trialing', trialEndsAt: PAST, expiresAt: null }],
  ['paid monthly', {}, { status: 'active', billingPeriod: 'monthly', expiresAt: FUTURE }],
  ['paid annual configured id', { product: 'sku.a1', store: 'play_store' }, { status: 'active', billingPeriod: 'annual', store: 'play_store' }],
  ['paid annual fallback', { product: 'app.yearly.v2' }, { status: 'active', billingPeriod: 'annual' }],
  ['cancelled but active', { unsubscribe_detected_at: PAST }, { status: 'active', autoRenew: false, expiresAt: FUTURE }],
  ['cancelled trial still active', { period: 'trial', unsubscribe_detected_at: PAST }, { status: 'trialing', autoRenew: false, trialEndsAt: FUTURE }],
  ['expired paid', { expiry: PAST }, { status: 'expired', expiresAt: PAST, autoRenew: false }],
  ['billing issue', { billing_issues_detected_at: PAST }, { status: 'active', billingIssue: true }],
  ['lifetime entitlement', { expiry: null }, { status: 'active', expiresAt: null }],
  ['malformed expiry cannot grant lifetime', { expiry: 'invalid' }, { status: 'expired' }]
];
for (const [name, input, expected] of cases) {
  test(name, () => {
    const mapped = mapSubscriber(customer(input), config, NOW);
    assert.equal(mapped.tier, 'premium');
    assert.equal(mapped.source, 'revenuecat');
    assert.equal(mapped.isSandbox, true);
    assert.equal(mapped.productId, input.product || 'sku.m1');
    assert.deepEqual(mapped.lastSyncedAt, NOW);
    for (const [field, value] of Object.entries(expected)) {
      assert.deepEqual(mapped[field], field.endsWith('At') && value ? new Date(value) : value, field);
    }
  });
}

test('no entitlement never grants access, even with unrelated purchases', () => {
  const payload = customer();
  payload.subscriber.entitlements = { unrelated: { expires_date: FUTURE } };
  const mapped = mapSubscriber(payload, config, NOW);
  assert.equal(mapped.status, 'none');
  assert.equal(mapped.tier, 'free');
  assert.equal(mapped.autoRenew, false);
  assert.equal(mapped.productId, null);
  assert.equal(mapSubscriber({}, config, NOW).status, 'none');
});

test('missing optional fields and uppercase trial are tolerated', () => {
  const payload = customer({ period: 'TRIAL' });
  delete payload.subscriber.subscriptions['sku.m1'].is_sandbox;
  delete payload.subscriber.subscriptions['sku.m1'].store;
  const mapped = mapSubscriber(payload, config, NOW);
  assert.equal(mapped.status, 'trialing');
  assert.equal(mapped.store, null);
  assert.equal(mapped.isSandbox, false);
});

test('fetch uses the server credential and app user id; rejects malformed/provider error responses', async () => {
  const payload = customer();
  const fetched = await fetchSubscriber(USER_ID, { config, fetchImpl: async (url, options) => {
    assert.equal(url, `https://api.revenuecat.com/v1/subscribers/${USER_ID}`);
    assert.equal(options.headers.Authorization, 'Bearer fixture-key');
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => payload };
  } });
  assert.equal(fetched, payload);
  await assert.rejects(fetchSubscriber(USER_ID, { config, fetchImpl: async () => ({ ok: false, status: 503 }) }), /HTTP 503/);
  await assert.rejects(fetchSubscriber(USER_ID, { config, fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), /invalid subscriber/);
});

const fakeStore = (subscription) => {
  let stored = { _id: USER_ID, subscription: structuredClone(subscription) };
  let now = NOW.getTime();
  let calls = 0;
  let down = false;
  const warnings = [];
  const service = createRevenueCatService({
    loadUser: async () => structuredClone(stored),
    claimRefresh: async (id, attempt) => {
      const last = new Date(stored.subscription.lastSyncAttemptAt || 0).getTime();
      if (attempt.getTime() - last < 60_000) return null;
      stored.subscription.lastSyncAttemptAt = attempt;
      return structuredClone(stored);
    },
    writeSubscription: async (id, mapped) => {
      stored.subscription = structuredClone(mapped);
      return structuredClone(stored);
    },
    recordFailure: async (id, attempt) => {
      stored.subscription.lastSyncAttemptAt = attempt;
      stored.subscription.lastSyncFailedAt = attempt;
    },
    fetchCustomer: async (id) => {
      calls++;
      assert.equal(id, USER_ID);
      if (down) throw new Error('fixture provider down');
      return customer();
    },
    config: () => config, clock: () => new Date(now), warn: (message) => warnings.push(message)
  });
  return {
    ...service, doc: () => structuredClone(stored), calls: () => calls,
    setDown: (value) => { down = value; }, setTime: (value) => { now = value; }, warnings
  };
};

test('sync saves only server-mapped state and coalesces simultaneous requests', async () => {
  const store = fakeStore({ status: 'none' });
  const [first, second] = await Promise.all([store.syncUserSubscription(USER_ID), store.syncUserSubscription(USER_ID)]);
  assert.equal(store.calls(), 1);
  assert.equal(first.subscription.status, 'active');
  assert.equal(second.subscription.source, 'revenuecat');
  await assert.rejects(store.syncUserSubscription('$RCAnonymousID:fixture'), /Invalid/);
});

test('GET freshness refreshes after 15 minutes and near-expiry attempts are throttled for 60 seconds', async () => {
  const mapped = mapSubscriber(customer(), config, new Date(NOW.getTime() - 16 * 60_000));
  const store = fakeStore(mapped);
  await store.refreshUserSubscription(store.doc(), { maxAgeMs: 15 * 60_000 });
  assert.equal(store.calls(), 1);
  await store.refreshUserSubscription(store.doc(), { maxAgeMs: 15 * 60_000 });
  assert.equal(store.calls(), 1);

  const near = fakeStore(mapSubscriber(customer({ expiry: new Date(NOW.getTime() + 4 * 60_000).toISOString() }), config, new Date(NOW.getTime() - 60_000)));
  near.setDown(true);
  await near.refreshUserSubscription(near.doc());
  await near.refreshUserSubscription(near.doc());
  assert.equal(near.calls(), 1);
  near.setTime(NOW.getTime() + 60_000);
  await near.refreshUserSubscription(near.doc());
  assert.equal(near.calls(), 2);
});

test('outage retains verified state only up to 24 hours after expiry, without changing expiry', async () => {
  const expiry = new Date(NOW.getTime() - 60_000);
  const store = fakeStore(mapSubscriber(customer({ expiry: expiry.toISOString() }), config, new Date(expiry.getTime() - 60_000)));
  store.setDown(true);
  const user = store.doc();
  await store.refreshUserSubscription(user);
  assert.equal(user.subscription.status, 'active');
  assert.deepEqual(user.subscription.expiresAt, expiry);
  assert.equal(user.$locals.revenuecatOutageGrace, true);
  assert.equal(store.warnings.length, 1);
  const throttled = store.doc();
  await store.refreshUserSubscription(throttled);
  assert.equal(throttled.$locals.revenuecatOutageGrace, true);
  assert.equal(store.calls(), 1);
  store.setTime(expiry.getTime() + 24 * 60 * 60_000);
  const after = store.doc();
  await store.refreshUserSubscription(after);
  assert.equal(after.$locals.revenuecatOutageGrace, false);
  assert.equal(canRetainAccessDuringOutage({ ...user.subscription, source: 'manual' }, NOW.getTime()), false);
  assert.equal(canRetainAccessDuringOutage({ ...user.subscription, lastSyncedAt: null }, NOW.getTime()), false);
});

test('trial outage preserves trial status and original trial end; confirmed lapse clears grace', async () => {
  const expiry = new Date(NOW.getTime() - 60_000);
  const subscription = mapSubscriber(customer({ period: 'trial', expiry: expiry.toISOString() }), config, new Date(expiry.getTime() - 60_000));
  const store = fakeStore(subscription);
  store.setDown(true);
  const user = store.doc();
  await store.refreshUserSubscription(user);
  assert.equal(user.subscription.status, 'trialing');
  assert.deepEqual(user.subscription.trialEndsAt, expiry);
  assert.equal(user.$locals.revenuecatOutageGrace, true);
  // A successful provider reply, including an already-lapsed trial, clears
  // any prior failure metadata rather than granting outage grace.
  const lapsed = mapSubscriber(customer({ period: 'trial', expiry: expiry.toISOString() }), config, NOW);
  assert.equal(lapsed.status, 'trialing');
  assert.equal(lapsed.lastSyncFailedAt, null);
});

const webhookHarness = () => {
  const seen = new Set();
  const jobs = [];
  const synced = [];
  const finished = [];
  const handler = createRevenueCatWebhookHandler({
    configuration: () => ({ authSecret: 'Bearer fixture-auth' }),
    claim: async (id) => { if (seen.has(id)) return false; seen.add(id); return true; },
    finish: async (id, status) => finished.push([id, status]),
    sync: async (id) => synced.push(id), schedule: (job) => jobs.push(job)
  });
  return { seen, jobs, synced, finished, deliver: async (event) => {
    let status;
    await handler({ headers: { authorization: 'Bearer fixture-auth' }, body: Buffer.from(JSON.stringify({ event })) },
      { sendStatus: (code) => { status = code; } }, (error) => { throw error; });
    return status;
  } };
};

test('anonymous-id webhook and TEST event acknowledge without syncing', async () => {
  const harness = webhookHarness();
  assert.equal(await harness.deliver({ id: 'anonymous', app_user_id: '$RCAnonymousID:fixture' }), 200);
  assert.equal(await harness.deliver({ type: 'TEST', app_user_id: USER_ID }), 200);
  assert.equal(harness.jobs.length, 0);
  assert.equal(harness.seen.size, 0);
});

test('duplicate event id is acknowledged once and sync runs after response', async () => {
  const harness = webhookHarness();
  const event = { id: 'duplicate', app_user_id: USER_ID, environment: 'SANDBOX' };
  assert.equal(await harness.deliver(event), 200);
  assert.equal(harness.synced.length, 0, 'verification must not delay the response');
  assert.equal(await harness.deliver(event), 200);
  assert.equal(harness.jobs.length, 1);
  await harness.jobs[0]();
  assert.deepEqual(harness.synced, [USER_ID]);
  assert.deepEqual(harness.finished, [['duplicate', 'processed']]);
});

test('transfer syncs valid from/to ids, including when app_user_id is anonymous', async () => {
  const event = { id: 'transfer', app_user_id: '$RCAnonymousID:fixture',
    transferred_from: [USER_ID, 'invalid'], transferred_to: [OTHER_ID, USER_ID] };
  assert.deepEqual(webhookUserIds(event).sort(), [USER_ID, OTHER_ID]);
  const harness = webhookHarness();
  assert.equal(await harness.deliver(event), 200);
  await harness.jobs[0]();
  assert.deepEqual(harness.synced.sort(), [USER_ID, OTHER_ID]);
});

test('production and sandbox notifications use the same verification path', async () => {
  const harness = webhookHarness();
  for (const environment of ['SANDBOX', 'PRODUCTION']) {
    assert.equal(await harness.deliver({ id: environment, app_user_id: USER_ID, environment }), 200);
  }
  for (const job of harness.jobs) await job();
  assert.deepEqual(harness.synced, [USER_ID, USER_ID]);
});

test('unconfigured webhook is disabled and invalid authorization is rejected before persistence', async () => {
  for (const [authSecret, expected] of [[undefined, 404], ['expected', 401]]) {
    let status;
    const handler = createRevenueCatWebhookHandler({
      configuration: () => ({ authSecret }),
      claim: () => { throw new Error('must not persist unverified events'); }
    });
    await handler({ headers: {}, body: Buffer.from('{}') },
      { sendStatus: (code) => { status = code; } }, (error) => { throw error; });
    assert.equal(status, expected);
  }
});

test('authorization and timestamped raw-body HMAC reject tampering and replay', () => {
  const rawBody = Buffer.from('{ "event": {"id":"signed"} }');
  const timestamp = String(Math.floor(NOW.getTime() / 1000));
  const signature = `t=${timestamp},v1=${createHmac('sha256', 'fixture-signing').update(`${timestamp}.`).update(rawBody).digest('hex')}`;
  const request = { rawBody, signature, authorization: 'Bearer fixture-auth',
    authSecret: 'Bearer fixture-auth', hmacSecret: 'fixture-signing', now: NOW.getTime() };
  assert.equal(verifyWebhook(request), true);
  assert.equal(verifyWebhook({ ...request, rawBody: Buffer.from('{}') }), false);
  assert.equal(verifyWebhook({ ...request, authorization: 'wrong' }), false);
  assert.equal(verifyWebhook({ ...request, authSecret: '' }), false);
  assert.equal(verifyWebhook({ ...request, now: NOW.getTime() + 301_000 }), false);
  assert.equal(verifyWebhook({ ...request, signature: 'bad' }), false);
});
