import getMessaging from '../config/firebase.js';
import DeviceToken from '../models/deviceToken.model.js';

const INVALID_TOKEN_CODES = [
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument'
];

export const sendToUser = async (userId, { title, body, data = {} }) => {
  const messaging = getMessaging();
  if (!messaging) return false;

  const devices = await DeviceToken.find({ user: userId }).select('token');
  if (devices.length === 0) return false;

  const tokens = devices.map((device) => device.token);

  const payloadData = Object.entries(data).reduce((accumulator, [key, value]) => {
    accumulator[key] = String(value);
    return accumulator;
  }, {});

  try {
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: payloadData
    });

    const deadTokens = response.responses
      .map((result, index) => (!result.success && INVALID_TOKEN_CODES.includes(result.error?.code) ? tokens[index] : null))
      .filter(Boolean);

    if (deadTokens.length > 0) {
      await DeviceToken.deleteMany({ token: { $in: deadTokens } });
    }

    return response.successCount > 0;
  } catch (error) {
    console.error('Push notification failed:', error.message);
    return false;
  }
};

export const sendToManyUsers = async (userIds, payload) => {
  const results = await Promise.all(userIds.map((userId) => sendToUser(userId, payload)));
  return results.filter(Boolean).length;
};
