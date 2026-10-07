#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";

async function main() {
  try {
    await connectDB();
    const admins = await User.find({ role: "admin" })
      .select("name email isEmailVerified createdAt updatedAt")
      .lean();
    if (!admins || admins.length === 0) {
      console.log("NO_ADMINS");
      process.exit(0);
    }

    console.log(`ADMINS_FOUND:${admins.length}`);
    admins.forEach((a) => {
      console.log(
        `${a.email} | ${a.name || ""} | verified:${Boolean(a.isEmailVerified)} | created:${a.createdAt}`,
      );
    });

    process.exit(0);
  } catch (err) {
    console.error("ERROR", err.message || err);
    process.exit(2);
  }
}

main();
