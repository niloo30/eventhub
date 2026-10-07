import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB() {
  const mongoUri = env.mongoUri;
  mongoose.set("strictQuery", true);
  try {
    // Extract db name properly from URI (handles query params like ?retryWrites=true)
    let dbName;
    try {
      const uriObj = new URL(mongoUri);
      dbName = uriObj.pathname.replace(/^\//, "").split("/")[0];
    } catch {
      // fallback: split on '/' and take last segment before any '?'
      dbName = mongoUri.split("/").pop()?.split("?")[0];
    }
    await mongoose.connect(mongoUri, { dbName: dbName || undefined });
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
}
