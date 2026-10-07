#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";

async function main() {
  const emails = process.argv.slice(2);
  if (!emails.length) {
    console.error(
      "Usage: node backend/scripts/deleteUser.js email1 [email2 ...]",
    );
    process.exit(1);
  }

  try {
    await connectDB();

    for (const raw of emails) {
      const email = String(raw || "")
        .trim()
        .toLowerCase();
      if (!email) {
        console.log("SKIP: empty email");
        continue;
      }

      const user = await User.findOne({ email });
      if (!user) {
        console.log(`${email}: NOT_FOUND`);
        continue;
      }

      await User.deleteOne({ _id: user._id });
      console.log(`${email}: DELETED`);
    }

    process.exit(0);
  } catch (err) {
    console.error("ERROR", err.message || err);
    process.exit(2);
  }
}

main();
