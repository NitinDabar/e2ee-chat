import express from "express";
import { authenticate } from "../middleware/auth.js";
import User from "../models/User.js";
import Message from "../models/Message.js";

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// Resolve identifier to ObjectId string
async function resolveUserIdString(identifier) {
  if (identifier.match(/^[a-f\d]{24}$/i)) return identifier;
  const user = await User.findOne({
    $or: [
      { username: identifier },
      { email: identifier },
    ],
  }).select("_id");
  return user ? String(user._id) : null;
}

// Block a user
router.post("/block", async (req, res) => {
  try {
    const me = req.userId;
    const { user } = req.body; // username/email/ObjectId
    const otherIdStr = await resolveUserIdString(String(user || ""));
    if (!otherIdStr) return res.status(404).json({ error: "User not found" });
    await User.updateOne({ _id: me }, { $addToSet: { blockedUsers: otherIdStr } });
    res.json({ success: true });
  } catch (e) {
    console.error("Block user error:", e);
    res.status(500).json({ error: "Failed to block user" });
  }
});

// Unblock a user
router.post("/unblock", async (req, res) => {
  try {
    const me = req.userId;
    const { user } = req.body;
    const otherIdStr = await resolveUserIdString(String(user || ""));
    if (!otherIdStr) return res.status(404).json({ error: "User not found" });
    await User.updateOne({ _id: me }, { $pull: { blockedUsers: otherIdStr } });
    res.json({ success: true });
  } catch (e) {
    console.error("Unblock user error:", e);
    res.status(500).json({ error: "Failed to unblock user" });
  }
});

// Delete a conversation (both directions) with another user
router.delete("/conversations/:other", async (req, res) => {
  try {
    const me = String(req.userId);
    const otherIdParam = req.params.other;
    let otherIdStr = await resolveUserIdString(otherIdParam);
    if (!otherIdStr) return res.status(404).json({ error: "User not found" });
    const result = await Message.deleteMany({
      $or: [
        { senderId: me, recipientId: otherIdStr },
        { senderId: otherIdStr, recipientId: me },
      ],
    });
    res.json({ success: true, deleted: result.deletedCount || 0 });
  } catch (e) {
    console.error("Delete conversation error:", e);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

export default router;



