import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import keyRoutes from "./routes/keyRoutes.js";
import { securityMiddleware } from "./middleware/security.js";
import { globalLimiter, authLimiter } from "./middleware/rateLimit.js";
import { replayGuard } from "./middleware/replay.js";

dotenv.config();
const app = express();

app.set("trust proxy", 1);
app.use(securityMiddleware);
app.use(express.json({ limit: "1mb" }));
app.use(globalLimiter);
app.use(replayGuard);

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/keys", keyRoutes);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/e2eechat";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

app.get("/", (req, res) => {
  res.send("E2EE Chat API is running");
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
