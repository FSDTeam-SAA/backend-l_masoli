import admin from 'firebase-admin';
import env from './env.js';

let messaging = null;
let initialized = false;

const getMessaging = () => {
  if (initialized) return messaging;
  initialized = true;

  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    console.warn('Firebase is not configured. Push notifications are disabled.');
    return null;
  }

  try {
    const app = admin.apps.length
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKey: env.FIREBASE_PRIVATE_KEY
          })
        });

    messaging = admin.messaging(app);
  } catch (error) {
    console.error('Firebase initialization failed:', error.message);
    messaging = null;
  }

  return messaging;
};

export default getMessaging;
