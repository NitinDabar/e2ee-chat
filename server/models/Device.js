import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    deviceId: { type: String, required: true },
    deviceName: { type: String },
    
    // Public keys only (zero-access)
    identityPublicKey: { type: String, required: true },
    keyAgreementPublicKey: { type: String, required: true },
    signedPrekey: { type: String, required: true },
    signedPrekeySignature: { type: String, required: true },
    oneTimePrekeys: [{ type: String }],
    
    // Device metadata
    lastSeen: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    revoked: { type: Boolean, default: false },
    revokedAt: { type: Date },
  },
  { timestamps: true }
);

deviceSchema.index({ userId: 1 });
// Ensure deviceId uniqueness per user
deviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

export default mongoose.model("Device", deviceSchema);

