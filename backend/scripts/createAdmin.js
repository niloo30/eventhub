#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error(
      'Usage: node scripts/createAdmin.js "Full Name" email@example.com password [--verify]',
    );
    process.exit(1);
  }

  const name = args[0];
  const email = String(args[1] || "")
    .trim()
    .toLowerCase();
  const password = args[2];
  const flags = args.slice(3);
  const verify = flags.includes("--verify") || flags.includes("-v");

  try {
    await connectDB();

    let user = await User.findOne({ email });
    if (user) {
      user.name = name;
      user.role = "admin";
      if (verify) user.isEmailVerified = true;
      if (password) user.password = password;
      await user.save();
      console.log(`${email}: UPDATED`);
    } else {
      user = await User.create({
        name,
        email,
        password,
        role: "admin",
        isEmailVerified: verify,
      });
      console.log(`${email}: CREATED`);
    }

    console.log(
      JSON.stringify(
        {
          id: user._id?.toString?.(),
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  } catch (err) {
    console.error("ERROR", err.message || err);
    process.exit(2);
  }
}

main();
