import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { StatusCodes } from 'http-status-codes';
import env from './config/env.js';
import rateLimiter from './middlewares/rateLimiter.js';
import notFound from './middlewares/notFound.js';
import globalErrorHandler from './middlewares/globalErrorHandler.js';
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
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/settings', settingRoutes);
app.use('/api/v1/content', contentRoutes);
app.use('/api/v1/home', homeRoutes);
app.use('/api/v1/goals', goalRoutes);
app.use('/api/v1/milestones', milestoneRoutes);
app.use('/api/v1/boards', visionBoardRoutes);
app.use('/api/v1/dreams', dreamRoutes);
app.use('/api/v1/progress', progressRoutes);
app.use('/api/v1/achievements', achievementRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin/dashboard', adminDashboardRoutes);
app.use('/api/v1/admin/users', adminUserRoutes);
app.use('/api/v1/admin/content', adminContentRoutes);
app.use('/api/v1/admin/notifications', adminNotificationRoutes);
app.use('/api/v1/uploads', uploadRoutes);

app.use(notFound);
app.use(globalErrorHandler);

export default app;
