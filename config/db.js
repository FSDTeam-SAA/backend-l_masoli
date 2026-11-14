import mongoose from 'mongoose';
import env from './env.js';

const connectDB = async () => {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected');
  });

  mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  await mongoose.connect(env.DATABASE_URL);

  return mongoose.connection;
};

export default connectDB;
