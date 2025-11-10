import express from "express";
import { sendMessage, getMessages, markAsRead, getQueuedMessages } from "../controllers/messageController.js";
import { authenticate } from "../middleware/auth.js";
import { validateEncryptedMessage } from "../middleware/validators.js";

const router = express.Router();

// All message routes require authentication
router.use(authenticate);

router.post("/send", validateEncryptedMessage, sendMessage);
router.get("/", getMessages);
router.get("/queued", getQueuedMessages);
router.post("/:messageId/read", markAsRead);

export default router;
