import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { syncUserSubscription } from './revenuecat.service.js';

const constantTimeEqual = (left, right) => timingSafeEqual(
  createHash('sha256').update(left).digest(), createHash('sha256').update(right).digest()
);

// https://www.revenuecat.com/docs/integrations/webhooks#webhook-signature-verification-hmac
export const verifyWebhook = ({ authorization, signature, rawBody, authSecret, hmacSecret, now = Date.now() }) => {
  if (!authSecret || !constantTimeEqual(authorization || '', authSecret)) return false;
  if (!hmacSecret) return true;
  if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string') return false;
  const parts = Object.fromEntries(signature.split(',').map((part) => {
    const separator = part.indexOf('=');
    return [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
  }));
  if (!/^\d+$/.test(parts.t || '') || !/^[a-f\d]{64}$/i.test(parts.v1 || '')) return false;
  if (Math.abs(now / 1000 - Number(parts.t)) > 300) return false;
  const expected = createHmac('sha256', hmacSecret).update(`${parts.t}.`).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(parts.v1, 'hex'));
};

export const webhookUserIds = (event) => [...new Set([
  event?.app_user_id,
  ...(Array.isArray(event?.transferred_to) ? event.transferred_to : []),
  ...(Array.isArray(event?.transferred_from) ? event.transferred_from : [])
].filter((id) => typeof id === 'string' && !id.startsWith('$RCAnonymousID:') && /^[a-f\d]{24}$/i.test(id))
  .map((id) => id.toLowerCase()))];

const eventModel = async () => (await import('../models/revenuecatEvent.model.js')).default;
const claimEvent = async (eventId, userIds) => {
  try {
    await (await eventModel()).create({ _id: eventId, userIds });
    return true;
  } catch (error) {
    if (error.code === 11000) return false;
    throw error;
  }
};
const finishEvent = async (eventId, status) => (await eventModel()).updateOne(
  { _id: eventId }, { $set: { status, processedAt: new Date() } }
);

export const createRevenueCatWebhookHandler = ({
  claim = claimEvent, finish = finishEvent, sync = syncUserSubscription,
  schedule = setImmediate, warn = (message) => console.warn(message),
  configuration = () => ({
    authSecret: process.env.REVENUECAT_WEBHOOK_AUTH,
    hmacSecret: process.env.REVENUECAT_WEBHOOK_HMAC_SECRET
  })
} = {}) => async (req, res, next) => {
  try {
    const config = configuration();
    if (!config.authSecret) return res.sendStatus(404);
    if (!verifyWebhook({
      ...config, authorization: req.headers.authorization,
      signature: req.headers['x-revenuecat-webhook-signature'], rawBody: req.body
    })) return res.sendStatus(401);
    let event;
    try {
      event = JSON.parse(req.body.toString('utf8'))?.event;
    } catch {
      return res.sendStatus(400);
    }
    if (!event || typeof event !== 'object') return res.sendStatus(400);
    if (event.type === 'TEST') return res.sendStatus(200);
    const userIds = webhookUserIds(event);
    if (!userIds.length) return res.sendStatus(200);
    if (typeof event.id !== 'string' || !event.id || event.id.length > 256) return res.sendStatus(400);
    // A single insert before acknowledgement makes deduplication durable.
    if (!await claim(event.id, userIds)) return res.sendStatus(200);
    res.sendStatus(200);
    schedule(async () => {
      try {
        const outcomes = await Promise.allSettled(userIds.map((id) => sync(id)));
        const failed = outcomes.some((result) => result.status === 'rejected');
        await finish(event.id, failed ? 'failed' : 'processed');
        if (failed) warn('[billing] RevenueCat webhook sync failed; authenticated freshness/sync will retry');
      } catch {
        warn('[billing] RevenueCat webhook processing failed; authenticated freshness/sync will retry');
      }
    });
  } catch (error) {
    next(error);
  }
};
