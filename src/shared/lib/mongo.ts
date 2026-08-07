import mongoose from 'mongoose';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 1000;

/**
 * Bounds on a connection that will not come up.
 *
 * Mongoose defaults `serverSelectionTimeoutMS` to 30 seconds, and this manager retries five times
 * with a second between — so an unreachable cluster took up to two and a half minutes to report a
 * failure, all of it inside whatever called it. In the reminder sweep that is the whole request
 * budget spent before a single reminder is looked at.
 *
 * `socketTimeoutMS` covers the other half: selection succeeding and then a query never returning,
 * which no amount of retrying detects because the connection is technically alive.
 */
const CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 8_000,
  connectTimeoutMS: 8_000,
  socketTimeoutMS: 20_000,
};

class MongoClientManager {
  private isConnected = false;

  async connect(retries = MAX_RETRIES): Promise<void> {
    if (this.isConnected) return;
    try {
      await mongoose.connect(process.env.MONGO_URI!, CONNECT_OPTIONS);
      this.isConnected = true;
      console.log('Connected to MongoDB');
    } catch (error) {
      if (retries <= 0) throw error;
      console.warn(`MongoDB connection failed, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return this.connect(retries - 1);
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await mongoose.disconnect();
      this.isConnected = false;
    }
  }
}

export const mongo = new MongoClientManager();
export { MongoClientManager };
