// server/scripts/clearUsers.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/e2ee_chat");
    console.log("Connected to MongoDB");
    const r = await User.deleteMany({});
    console.log("Deleted users count:", r.deletedCount);
    await mongoose.disconnect();
    console.log("Disconnected");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
