#!/usr/bin/env node
import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node backend/scripts/findUser.js email@example.com");
    process.exit(1);
  }

  try {
    await connectDB();
    const normalized = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalized }).lean();
    if (!user) {
      console.log("NOT_FOUND");
      process.exit(0);
    }

    // redact sensitive fields
    if (user.password) delete user.password;
    if (user.authOtpCodeHash) delete user.authOtpCodeHash;
    if (user.passwordResetToken) delete user.passwordResetToken;

    console.log(JSON.stringify(user, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("ERROR", err.message || err);
    process.exit(2);
  }
}

main();
