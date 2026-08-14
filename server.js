import mongoose from 'mongoose';
import env from './config/env.js';
import connectDB from './config/db.js';
import app from './app.js';
import startJobs from './jobs/index.js';

let server;
// macOS-এ Active Web Connections/Sockets ট্রাক রাখার জন্য Set
const activeSockets = new Set();

const bootstrap = async () => {
  await connectDB();

  // macOS Network Socket issue এড়াতে explicit "0.0.0.0" দেওয়া হয়েছে
  server = app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  // Track HTTP Sockets to force kill them on restart
  server.on("connection", (socket) => {
    activeSockets.add(socket);
    socket.once("close", () => activeSockets.delete(socket));
  });

  if (env.ENABLE_CRON) {
    startJobs();
  }
};

let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n${signal} received. Shutting down gracefully...`);

  // ১. সব Active HTTP Connections সাথে সাথে Destroy করুন
  for (const socket of activeSockets) {
    socket.destroy();
  }
  activeSockets.clear();

  // ২. Server Close করুন
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  // ৩. MongoDB Connection Close করুন
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }

  process.exit(0);
};

// Start the server
bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Process Error Handlers
process.on('unhandledRejection', (error) => {
  console.error('UNHANDLED REJECTION! Shutting down...', error);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...', error);
  process.exit(1);
});

// Signal Handlers (SIGUSR2 সহ সব সিগন্যাল হ্যান্ডেল করা হচ্ছে)
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.once('SIGUSR2', async () => {
  await shutdown('SIGUSR2');
  process.kill(process.pid, 'SIGUSR2');
});