import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { StatusCodes } from 'http-status-codes';
import env from './config/env.js';
import rateLimiter from './middlewares/rateLimiter.js';
import notFound from './middlewares/notFound.js';
import globalErrorHandler from './middlewares/globalErrorHandler.js';
import auth from './middlewares/auth.js';
import requireAccess from './middlewares/requireAccess.js';
import uploadRoutes from './routes/upload.routes.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import settingRoutes from './routes/setting.routes.js';
import contentRoutes from './routes/content.routes.js';
import homeRoutes from './routes/home.routes.js';
import goalRoutes from './routes/goal.routes.js';
import milestoneRoutes from './routes/milestone.routes.js';
import visionBoardRoutes from './routes/visionBoard.routes.js';
import dreamRoutes from './routes/dream.routes.js';
import progressRoutes from './routes/progress.routes.js';
import achievementRoutes from './routes/achievement.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import adminContentRoutes from './routes/adminContent.routes.js';
import adminUserRoutes from './routes/adminUser.routes.js';
import adminDashboardRoutes from './routes/adminDashboard.routes.js';
import adminNotificationRoutes from './routes/adminNotification.routes.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : true,
    credentials: true
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

app.use('/api', rateLimiter());

app.get('/', (req, res) => {
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'My Dream Board API is running'
  });
});

app.get('/health', (req, res) => {
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Healthy',
    data: { uptime: process.uptime(), timestamp: new Date().toISOString() }
  });
});

app.use('/api/v1/auth', authRoutes);
// Gate feature data at the mount, before any read/write controller runs.
// Profile, subscription, deletion, settings, help pages and device tokens stay accessible.
app.use(
  [
    '/api/v1/users/me/stats',
    '/api/v1/users/me/completed-goals',
    '/api/v1/content/areas',
    '/api/v1/content/priorities',
    '/api/v1/content/cover-moods',
    '/api/v1/content/collage-layouts',
    '/api/v1/content/quotes'
  ],
  auth(),
  requireAccess
);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/settings', settingRoutes);
app.use('/api/v1/content', contentRoutes);
app.use('/api/v1/home', auth(), requireAccess, homeRoutes);
app.use('/api/v1/goals', auth(), requireAccess, goalRoutes);
app.use('/api/v1/milestones', auth(), requireAccess, milestoneRoutes);
app.use('/api/v1/boards', auth(), requireAccess, visionBoardRoutes);
app.use('/api/v1/dreams', auth(), requireAccess, dreamRoutes);
app.use('/api/v1/progress', auth(), requireAccess, progressRoutes);
app.use('/api/v1/achievements', auth(), requireAccess, achievementRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin/dashboard', adminDashboardRoutes);
app.use('/api/v1/admin/users', adminUserRoutes);
app.use('/api/v1/admin/content', adminContentRoutes);
app.use('/api/v1/admin/notifications', adminNotificationRoutes);
app.use('/api/v1/uploads', auth(), requireAccess, uploadRoutes);

app.use(notFound);
app.use(globalErrorHandler);

export default app;
