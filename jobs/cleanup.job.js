import RefreshToken from '../models/refreshToken.model.js';
import DeviceToken from '../models/deviceToken.model.js';
import Otp from '../models/otp.model.js';
import { addDays } from '../utils/dateHelper.js';

const STALE_DEVICE_DAYS = 90;

const runCleanup = async () => {
  const [tokens, devices, otps] = await Promise.all([
    RefreshToken.deleteMany({
      $or: [{ expiresAt: { $lt: new Date() } }, { revokedAt: { $lt: addDays(new Date(), -7) } }]
    }),
    DeviceToken.deleteMany({ lastUsedAt: { $lt: addDays(new Date(), -STALE_DEVICE_DAYS) } }),
    Otp.deleteMany({ expiresAt: { $lt: addDays(new Date(), -1) } })
  ]);

  console.log(
    `[cron] cleanup removed - refreshTokens: ${tokens.deletedCount}, deviceTokens: ${devices.deletedCount}, otps: ${otps.deletedCount}`
  );

  return tokens.deletedCount + devices.deletedCount + otps.deletedCount;
};

export default runCleanup;
