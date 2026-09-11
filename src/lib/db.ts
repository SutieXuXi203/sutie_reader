import mongoose from 'mongoose';
import dns from 'dns';

// Fix for Node.js failing to resolve MongoDB SRV records on some Windows setups
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (error) {
  console.warn('Could not set custom DNS servers:', error);
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  uri?: string | null;
}

const globalWithMongoose = globalThis as typeof globalThis & {
  mongoose?: MongooseCache;
};

const cached: MongooseCache =
  globalWithMongoose.mongoose ?? { conn: null, promise: null, uri: null };
globalWithMongoose.mongoose = cached;

export async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable');
  }

  if (cached.conn && cached.uri !== MONGODB_URI) {
    try {
      await mongoose.disconnect();
    } catch {}
    cached.conn = null;
    cached.promise = null;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.uri = MONGODB_URI;
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    }).then(() => mongoose);
  }
  try {
    cached.conn = await cached.promise;
    cached.uri = MONGODB_URI;
  } catch (e) {
    cached.promise = null;
    cached.uri = null;
    throw e;
  }
  return cached.conn;
}
