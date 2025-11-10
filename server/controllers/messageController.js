import Message from "../models/Message.js";
import Device from "../models/Device.js";
import User from "../models/User.js";

/**
 * Send encrypted message (zero-access - server stores only ciphertext)
 */
export const sendMessage = async (req, res) => {
  try {
    const {
      recipientId,
      ciphertext,
      nonce,
      dhPublicKey,
      messageNumber,
      previousChainLength,
      senderDeviceId,
      recipientDeviceIds,
      type = "text",
      attachments,
    } = req.body;
    
    const senderId = req.userId; // From auth middleware

    if (!recipientId || !ciphertext || !nonce) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    // Block checks: either party blocking the other
    const senderUser = await User.findById(senderId).select("blockedUsers");
    const recipientUser = await User.findById(recipientUserObjectId).select("blockedUsers");
    if (senderUser?.blockedUsers?.includes(recipientUserIdString) || recipientUser?.blockedUsers?.includes(String(senderId))) {
      return res.status(403).json({ error: "Messaging is blocked between these users" });
    }

    // Resolve recipient identifier (allow username/email or ObjectId string)
    let recipientUserIdString = recipientId;
    let recipientUserObjectId = null;
    if (!recipientUserIdString.match(/^[a-f\d]{24}$/i)) {
      const user = await User.findOne({
        $or: [
          { username: recipientUserIdString },
          { email: recipientUserIdString },
        ],
      }).select("_id");
      if (!user) {
        return res.status(404).json({ error: "Recipient not found" });
      }
      recipientUserObjectId = user._id;
      recipientUserIdString = String(user._id);
    } else {
      // Provided is ObjectId string; use for device lookups as ObjectId
      recipientUserObjectId = recipientUserIdString;
    }

    // Get recipient devices for fan-out (if not provided)
    let deviceIds = recipientDeviceIds;
    if (!deviceIds || deviceIds.length === 0) {
      const recipientDevices = await Device.find({
        userId: recipientUserObjectId,
        revoked: false,
      }).select("deviceId");
      deviceIds = recipientDevices.map((d) => d.deviceId);
    }

    // Create message with encrypted content only
    const msg = new Message({
      senderId,
      recipientId: recipientUserIdString,
      senderDeviceId,
      recipientDeviceIds: deviceIds,
      ciphertext, // Zero-access: only encrypted data
      nonce,
      dhPublicKey,
      messageNumber,
      previousChainLength,
      associatedData: {
        senderId,
        recipientId,
        timestamp: new Date(),
      },
      type,
      attachments: attachments || [],
      queued: true,
      delivered: false,
    });

    await msg.save();

    // Return minimal metadata (no plaintext)
    res.status(201).json({
      id: msg._id,
      senderId: msg.senderId,
      recipientId: msg.recipientId,
      createdAt: msg.createdAt,
      messageNumber: msg.messageNumber,
      type: msg.type,
    });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
};

/**
 * Get encrypted messages (zero-access - returns only ciphertext)
 */
export const getMessages = async (req, res) => {
  try {
    const currentUserId = req.userId;
    const { recipientId } = req.query;
    const deviceId = req.query.deviceId; // Current device ID

    let query = {
      $or: [
        { senderId: currentUserId },
        { recipientId: currentUserId },
      ],
    };

    // If recipientId is provided, get messages between current user and that recipient
    if (recipientId) {
      let otherUserIdString = recipientId;
      if (!otherUserIdString.match(/^[a-f\d]{24}$/i)) {
        const user = await User.findOne({
          $or: [
            { username: otherUserIdString },
            { email: otherUserIdString },
          ],
        }).select("_id");
        if (!user) {
          return res.json([]);
        }
        otherUserIdString = String(user._id);
      }
      query = {
        $or: [
          { senderId: currentUserId, recipientId: otherUserIdString },
          { senderId: otherUserIdString, recipientId: currentUserId },
        ],
      };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .select("ciphertext nonce dhPublicKey messageNumber previousChainLength senderId recipientId createdAt type attachments associatedData");

    // Mark as delivered if deviceId provided
    if (deviceId) {
      const messageIds = messages
        .filter((m) => m.recipientId === currentUserId && !m.deliveredToDevices?.includes(deviceId))
        .map((m) => m._id);
      
      if (messageIds.length > 0) {
        await Message.updateMany(
          { _id: { $in: messageIds } },
          {
            $set: { delivered: true, deliveredAt: new Date() },
            $addToSet: { deliveredToDevices: deviceId },
          }
        );
      }
    }

    res.json(messages);
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

/**
 * Mark message as read
 */
export const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const deviceId = req.query.deviceId;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.recipientId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    message.read = true;
    if (!message.readAt) {
      message.readAt = new Date();
    }
    if (deviceId && !message.readByDevices?.includes(deviceId)) {
      message.readByDevices = message.readByDevices || [];
      message.readByDevices.push(deviceId);
    }

    await message.save();

    res.json({ success: true });
  } catch (err) {
    console.error("Mark as read error:", err);
    res.status(500).json({ error: "Failed to mark message as read" });
  }
};

/**
 * Get queued messages (for offline delivery)
 */
export const getQueuedMessages = async (req, res) => {
  try {
    const userId = req.userId;
    const deviceId = req.query.deviceId;

    const messages = await Message.find({
      recipientId: userId,
      queued: true,
      $or: [
        { recipientDeviceIds: { $in: [deviceId] } },
        { recipientDeviceIds: { $size: 0 } }, // Messages for all devices
      ],
    })
      .sort({ createdAt: 1 })
      .limit(50)
      .select("ciphertext nonce dhPublicKey messageNumber previousChainLength senderId recipientId createdAt type");

    res.json(messages);
  } catch (err) {
    console.error("Get queued messages error:", err);
    res.status(500).json({ error: "Failed to fetch queued messages" });
  }
};
