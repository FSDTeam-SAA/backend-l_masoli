// RevenueCat v1 field reference:
// https://www.revenuecat.com/docs/api-v1/customer-info-model
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const date = (value) => {
  if (value == null || value === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const productIds = (value) => (value || '').split(',').map((id) => id.trim()).filter(Boolean);

export const revenueCatConfig = () => ({
  apiKey: (process.env.REVENUECAT_SECRET_API_KEY || '').trim(),
  entitlementId: process.env.REVENUECAT_ENTITLEMENT_ID || 'premium',
  monthlyProductIds: productIds(process.env.REVENUECAT_MONTHLY_PRODUCT_IDS),
  annualProductIds: productIds(process.env.REVENUECAT_ANNUAL_PRODUCT_IDS)
});

export const mapSubscriber = (payload, config = revenueCatConfig(), now = new Date()) => {
  const subscriber = payload?.subscriber || {};
  const entitlement = subscriber.entitlements?.[config.entitlementId];
  const base = {
    source: 'revenuecat', tier: 'free', status: 'none', billingPeriod: null,
    startedAt: null, trialEndsAt: null, expiresAt: null, store: null,
    isSandbox: false, autoRenew: false, billingIssue: false, productId: null,
    lastSyncedAt: now, lastSyncAttemptAt: now, lastSyncFailedAt: null
  };
  if (!entitlement || typeof entitlement !== 'object') return base;

  const productId = entitlement.product_identifier || null;
  const purchase = subscriber.subscriptions?.[productId] || {};
  const nonSubscription = subscriber.non_subscriptions?.[productId];
  const details = Object.keys(purchase).length ? purchase : (nonSubscription?.at(-1) || {});
  // Missing entitlement expiry falls back to the subscription expiry. A
  // genuinely null expiry represents a non-expiring entitlement.
  const rawExpiry = entitlement.expires_date === undefined
    ? details.expires_date : entitlement.expires_date;
  const expiry = date(rawExpiry);
  // Malformed non-empty dates must never turn into a lifetime grant.
  const invalidExpiry = rawExpiry != null && rawExpiry !== '' && !expiry;
  const expired = invalidExpiry || (expiry && expiry.getTime() <= now.getTime());
  const trial = String(details.period_type || entitlement.period_type || '').toLowerCase() === 'trial';
  const billingPeriod = (config.annualProductIds || []).includes(productId) ? 'annual'
    : (config.monthlyProductIds || []).includes(productId) ? 'monthly'
      : /annual|yearly/i.test(productId || '') ? 'annual' : 'monthly';
  return {
    ...base,
    tier: 'premium', status: trial ? 'trialing' : expired ? 'expired' : 'active',
    billingPeriod, productId,
    startedAt: date(entitlement.purchase_date || details.purchase_date || details.original_purchase_date),
    trialEndsAt: trial ? (invalidExpiry ? new Date(0) : expiry) : null,
    expiresAt: trial ? null : expiry,
    store: ['app_store', 'play_store'].includes(details.store) ? details.store : null,
    isSandbox: details.is_sandbox === true,
    autoRenew: !expired && !details.unsubscribe_detected_at && Object.keys(purchase).length > 0,
    billingIssue: Boolean(details.billing_issues_detected_at)
  };
};

export const fetchSubscriber = async (appUserId, { config = revenueCatConfig(), fetchImpl = globalThis.fetch } = {}) => {
  if (!config.apiKey?.trim()) return null;
  const response = await fetchImpl(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(String(appUserId))}`,
    { headers: { Authorization: `Bearer ${config.apiKey}`, Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
  );
  if (!response.ok) throw new Error(`RevenueCat HTTP ${response.status}`);
  const payload = await response.json();
  // An invalid/error payload is an outage, never evidence of no subscription.
  if (!payload?.subscriber || typeof payload.subscriber !== 'object' || Array.isArray(payload.subscriber)) {
    throw new Error('RevenueCat returned an invalid subscriber');
  }
  return payload;
};

export const subscriptionExpiry = (subscription) => date(
  subscription?.status === 'trialing' ? subscription.trialEndsAt : subscription?.expiresAt
);

export const canRetainAccessDuringOutage = (subscription, now = Date.now()) => {
  const expiry = subscriptionExpiry(subscription)?.getTime();
  return subscription?.source === 'revenuecat' && Boolean(subscription.lastSyncedAt) &&
    ['trialing', 'active'].includes(subscription.status) &&
    expiry != null && expiry <= now && now < expiry + DAY;
};

// Lazy imports keep the mapper and dependency-injected fixtures independent
// of MongoDB, app configuration and external services.
const userModel = async () => (await import('../models/user.model.js')).default;
const defaultLoadUser = async (id) => (await userModel()).findOne({ _id: id, isDeleted: false });
const defaultClaimRefresh = async (id, now) => (await userModel()).findOneAndUpdate(
  { _id: id, isDeleted: false, $or: [
    { 'subscription.lastSyncAttemptAt': null },
    { 'subscription.lastSyncAttemptAt': { $lte: new Date(now.getTime() - MINUTE) } }
  ] },
  { $set: { 'subscription.lastSyncAttemptAt': now } },
  { new: true }
);
const defaultWrite = async (id, subscription, { hasEntitlement } = {}) => (await userModel()).findOneAndUpdate(
  {
    _id: id, isDeleted: false,
    // A concurrent demo PATCH must also survive a no-entitlement response.
    ...(!hasEntitlement && { 'subscription.source': 'revenuecat' })
  },
  { $set: { subscription } }, { new: true, runValidators: true }
);
const defaultFailure = async (id, now) => (await userModel()).updateOne(
  { _id: id, isDeleted: false },
  { $set: { 'subscription.lastSyncAttemptAt': now, 'subscription.lastSyncFailedAt': now } }
);

export const createRevenueCatService = ({
  loadUser = defaultLoadUser, claimRefresh = defaultClaimRefresh,
  writeSubscription = defaultWrite, recordFailure = defaultFailure,
  fetchCustomer = fetchSubscriber, config = revenueCatConfig,
  clock = () => new Date(), warn = (message) => console.warn(message)
} = {}) => {
  const inFlight = new Map();
  const syncUserSubscription = (userId, { throttle = false } = {}) => {
    const id = String(userId);
    if (!/^[a-f\d]{24}$/i.test(id)) return Promise.reject(new Error('Invalid RevenueCat app user id'));
    if (inFlight.has(id)) return inFlight.get(id);
    const operation = (async () => {
      const settings = config();
      // No provider call, attempt/failure write, or state mapping without a
      // server key. Explicit sync still returns the current plan snapshot.
      if (!settings.apiKey?.trim()) return loadUser(id);
      const now = clock();
      const user = throttle ? await claimRefresh(id, now) : await loadUser(id);
      if (!user) return throttle ? loadUser(id) : null;
      try {
        const payload = await fetchCustomer(id, { config: settings });
        const entitlement = payload?.subscriber?.entitlements?.[settings.entitlementId];
        const hasEntitlement = entitlement != null && typeof entitlement === 'object' && !Array.isArray(entitlement);
        // Milestone 1 demo/legacy state is not evidence of an RC purchase.
        // Only a matching, verified entitlement authorizes that migration.
        if (!hasEntitlement && user.subscription?.source !== 'revenuecat') return loadUser(id);
        const updated = await writeSubscription(id, mapSubscriber(payload, settings, clock()), { hasEntitlement });
        return updated || loadUser(id);
      } catch (error) {
        // Never log provider payloads, headers, keys, or fetch error objects.
        warn(`[billing] RevenueCat sync unavailable for user ${id}; keeping last verified subscription`);
        await recordFailure(id, now);
        throw error;
      }
    })().finally(() => inFlight.delete(id));
    inFlight.set(id, operation);
    return operation;
  };

  const refreshUserSubscription = async (user, { maxAgeMs = null } = {}) => {
    const subscription = user.subscription || {};
    if (!config().apiKey?.trim()) return user;
    const now = clock().getTime();
    const expiry = subscriptionExpiry(subscription)?.getTime();
    const nearingExpiry = ['trialing', 'active'].includes(subscription.status) &&
      expiry != null && expiry <= now + 5 * MINUTE;
    const lastSync = date(subscription.lastSyncedAt)?.getTime() || 0;
    const stale = maxAgeMs != null && now - lastSync >= maxAgeMs;
    if (nearingExpiry || stale) {
      try {
        const refreshed = await syncUserSubscription(user._id, { throttle: true });
        if (refreshed && (refreshed.subscription?.source === 'revenuecat' || subscription.source === 'revenuecat')) {
          user.subscription = refreshed.subscription;
        }
        // Preserve Mongoose's default-status marker on untouched legacy
        // Premium accounts. Reassigning a defaulted `none` status would make
        // it explicit and incorrectly disable the existing legacy resolver.
      } catch {
        // Persisted failure timestamp lets the next request share outage grace
        // even when it is throttled or handled by another server process.
        user.subscription.lastSyncFailedAt = clock();
      }
    }
    const failureAt = date(user.subscription?.lastSyncFailedAt)?.getTime();
    const syncedAt = date(user.subscription?.lastSyncedAt)?.getTime() || 0;
    user.$locals ||= {};
    user.$locals.revenuecatOutageGrace = Boolean(failureAt && failureAt >= syncedAt &&
      canRetainAccessDuringOutage(user.subscription, now));
    // The service already persisted billing updates atomically. A later
    // profile save must not write this request's subscription copy back.
    user.unmarkModified?.('subscription');
    user.unmarkModified?.('subscription.lastSyncFailedAt');
    return user;
  };
  return { syncUserSubscription, refreshUserSubscription };
};

const service = createRevenueCatService();
export const syncUserSubscription = service.syncUserSubscription;
export const refreshUserSubscription = service.refreshUserSubscription;
