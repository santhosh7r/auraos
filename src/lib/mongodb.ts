import mongoose from "mongoose";

/**
 * Cached MongoDB connection for Next.js. Avoids creating a new connection
 * on every hot-reload in dev and reuses the connection across serverless
 * invocations in production.
 *
 * Set MONGODB_URI in .env.local — see .env.example.
 */

const MONGODB_URI = process.env.MONGODB_URI || "";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global._mongoose || { conn: null, promise: null };
if (!global._mongoose) global._mongoose = cached;

export async function connectToDatabase() {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local (see .env.example). " +
        "The app ships with seed data so the UI renders without a database."
    );
  }
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      // database name is taken from the connection string (e.g. /auraos)
      serverSelectionTimeoutMS: 15000,
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export function isDbConfigured() {
  return Boolean(MONGODB_URI);
}
