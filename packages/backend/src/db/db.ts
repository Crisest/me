import mongoose from 'mongoose';
import { config } from '../config/env';

export const connectToDatabase = async () => {
  try {
    console.log('connecting to db');
    await mongoose.connect(config.mongoUri, {});
    console.log(`Connected to MongoDB with Mongoose`);
  } catch (error) {
    console.error('Error connecting to MongoDB with Mongoose:', error);
    throw error;
  }
};
