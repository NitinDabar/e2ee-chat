import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: { type: String, required: true, index: true },
    recipientId: { type: String, required: true, index: true },
    senderDeviceId: { type: String },
    recipientDeviceIds: [{ type: String }], // For multi-device fan-out
    
    // Zero-access: Only encrypted ciphertext
    ciphertext: { type: String, required: true },
    nonce: { type: String, required: true },
    
    // Double ratchet metadata (never plaintext)
    dhPublicKey: { type: String }, // Sender's current DH public key
    messageNumber: { type: Number, required: true },
    previousChainLength: { type: Number, default: 0 },
    
    // Associated data (for AEAD verification)
    associatedData: {
      senderId: { type: String },
      recipientId: { type: String },
      timestamp: { type: Date },
    },
    
    // Delivery status
    delivered: { type: Boolean, default: false },
    deliveredAt: { type: Date },
    deliveredToDevices: [{ type: String }],
    read: { type: Boolean, default: false },
    readAt: { type: Date },
    readByDevices: [{ type: String }],
    
    // Retry/queue management
    retryCount: { type: Number, default: 0 },
    queued: { type: Boolean, default: true },
    
    // Attachments (encrypted)
    attachments: [
      {
        encryptedBlob: { type: String }, // Base64 encoded encrypted file
        contentType: { type: String },
        contentHash: { type: String }, // SHA-256 of encrypted content
        size: { type: Number },
      },
    ],
    
    // Message type
    type: { type: String, enum: ["text", "attachment", "system"], default: "text" },
  },
  { timestamps: true }
);

// Indexes for efficient querying
messageSchema.index({ senderId: 1, recipientId: 1, createdAt: 1 });
messageSchema.index({ recipientId: 1, queued: 1, delivered: 1 });
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // 1 year TTL

export default mongoose.model("Message", messageSchema);
