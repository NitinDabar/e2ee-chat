import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    blockedUsers: [{ type: String }],
    // Device key bundles (zero-access - server never sees private keys)
    devices: [
      {
        deviceId: { type: String, required: true },
        deviceName: { type: String },
        identityPublicKey: { type: String, required: true },
        keyAgreementPublicKey: { type: String, required: true },
        signedPrekey: { type: String, required: true },
        signedPrekeySignature: { type: String, required: true },
        oneTimePrekeys: [{ type: String }],
        createdAt: { type: Date, default: Date.now },
        lastSeen: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
