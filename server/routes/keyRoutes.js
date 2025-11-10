import express from "express";
import { authenticate } from "../middleware/auth.js";
import User from "../models/User.js";
import Device from "../models/Device.js";

const router = express.Router();

// All key routes require authentication
router.use(authenticate);

/**
 * Upload/update device key bundle
 */
router.post("/device/keys", async (req, res) => {
  try {
    const userId = req.userId;
    const {
      deviceId,
      deviceName,
      identityPublicKey,
      keyAgreementPublicKey,
      signedPrekey,
      signedPrekeySignature,
      oneTimePrekeys,
    } = req.body;

    if (!deviceId || !identityPublicKey || !keyAgreementPublicKey || !signedPrekey) {
      return res.status(400).json({ error: "Missing required key fields" });
    }

    // Idempotent upsert to avoid race conditions and duplicate key errors
    const update = {
      $set: {
        deviceName: deviceName || undefined,
        identityPublicKey,
        keyAgreementPublicKey,
        signedPrekey,
        signedPrekeySignature,
        oneTimePrekeys: oneTimePrekeys || [],
        lastSeen: new Date(),
      },
      $setOnInsert: {
        userId,
        deviceId,
        createdAt: new Date(),
      },
    };

    const options = { upsert: true, new: true, returnDocument: "after" };
    const device = await Device.findOneAndUpdate({ userId, deviceId }, update, options);

    res.json({
      success: true,
      deviceId: device.deviceId,
      message: "Device keys uploaded successfully",
    });
  } catch (err) {
    console.error("Upload device keys error:", err);
    // Handle duplicate key race gracefully
    if (err.code === 11000) {
      return res.status(200).json({ success: true, message: "Device already registered" });
    }
    res.status(500).json({ error: "Failed to upload device keys" });
  }
});

/**
 * Get user's public key bundle (for session establishment)
 */
router.get("/user/:userId/bundle", async (req, res) => {
  try {
    const { userId } = req.params;
    let lookupUserId = userId;

    // Allow username or email in addition to ObjectId
    if (!lookupUserId.match(/^[a-f\d]{24}$/i)) {
      const user = await User.findOne({
        $or: [
          { username: lookupUserId },
          { email: lookupUserId },
        ],
      }).select("_id");
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      lookupUserId = user._id;
    }

    // Get all active devices for the user
    const devices = await Device.find({
      userId: lookupUserId,
      revoked: false,
    }).select("deviceId deviceName identityPublicKey keyAgreementPublicKey signedPrekey signedPrekeySignature oneTimePrekeys");

    if (devices.length === 0) {
      return res.status(404).json({ error: "User not found or has no devices" });
    }

    // Return device bundles (client will select which to use)
    res.json({
      userId: lookupUserId,
      devices: devices.map((d) => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        identityPublicKey: d.identityPublicKey,
        keyAgreementPublicKey: d.keyAgreementPublicKey,
        signedPrekey: d.signedPrekey,
        signedPrekeySignature: d.signedPrekeySignature,
        oneTimePrekeys: d.oneTimePrekeys.slice(0, 10), // Return first 10
      })),
    });
  } catch (err) {
    console.error("Get user bundle error:", err);
    res.status(500).json({ error: "Failed to get user bundle" });
  }
});

/**
 * Get my devices
 */
router.get("/devices", async (req, res) => {
  try {
    const userId = req.userId;
    const devices = await Device.find({ userId, revoked: false }).select(
      "deviceId deviceName createdAt lastSeen"
    );

    res.json({ devices });
  } catch (err) {
    console.error("Get devices error:", err);
    res.status(500).json({ error: "Failed to get devices" });
  }
});

/**
 * Revoke a device
 */
router.post("/device/:deviceId/revoke", async (req, res) => {
  try {
    const userId = req.userId;
    const { deviceId } = req.params;

    const device = await Device.findOne({ deviceId, userId });
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    device.revoked = true;
    device.revokedAt = new Date();
    await device.save();

    res.json({ success: true, message: "Device revoked" });
  } catch (err) {
    console.error("Revoke device error:", err);
    res.status(500).json({ error: "Failed to revoke device" });
  }
});

export default router;

