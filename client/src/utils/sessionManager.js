import {
  DoubleRatchetState,
  x3dhKeyAgreement,
  encryptMessage,
  decryptMessage,
  generateSafetyNumber,
} from "./crypto.js";

/**
 * Session Manager - Handles double ratchet sessions per conversation
 */
export class SessionManager {
  constructor(userId, deviceKeys) {
    this.userId = userId;
    this.deviceKeys = deviceKeys;
    this.sessions = new Map(); // Map<recipientId, DoubleRatchetState>
    this.safetyNumbers = new Map(); // Map<recipientId, safetyNumber>
  }

  /**
   * Initialize session with a recipient using X3DH
   */
  async initializeSession(
    recipientId,
    theirIdentityPublicKey,
    theirSignedPrekeyPublicKey,
    theirSignedPrekeySignature,
    theirOneTimePrekeyPublicKey = null
  ) {
    // Generate shared secret via X3DH
    const sharedSecret = await x3dhKeyAgreement(
      this.deviceKeys.identityPrivateKey,
      this.deviceKeys.keyAgreementPrivateKey,
      theirIdentityPublicKey,
      theirSignedPrekeyPublicKey,
      theirSignedPrekeySignature,
      theirOneTimePrekeyPublicKey
    );

    // Create double ratchet state
    const state = new DoubleRatchetState(sharedSecret, theirSignedPrekeyPublicKey);
    
    // Initialize sending chain
    await state.initializeSendingChain(theirSignedPrekeyPublicKey);
    
    this.sessions.set(recipientId, state);

    // Generate safety number
    const safetyNumber = await generateSafetyNumber(
      this.deviceKeys.identityPublicKey,
      this.deviceKeys.signedPrekey,
      theirIdentityPublicKey,
      theirSignedPrekeyPublicKey
    );
    this.safetyNumbers.set(recipientId, safetyNumber);

    return state;
  }

  /**
   * Encrypt message for a recipient
   */
  async encryptMessageForRecipient(recipientId, plaintext, senderId, recipientIdParam, timestamp) {
    let session = this.sessions.get(recipientId);
    
    if (!session) {
      throw new Error(`No session established with ${recipientId}`);
    }

    // Step sending chain to get message key
    const messageKey = await session.stepSendingChain();

    // Deterministic associated data derived from both participant IDs
    const ad = SessionManager.computeConversationAssociatedData(senderId, recipientIdParam);

    // Encrypt message with associated data so both sides can verify context
    const encrypted = await encryptMessage(messageKey, plaintext, ad);

    // Get current DH public key
    const dhPublicKey = session.dhRatchetKeyPair
      ? await this.getPublicKeyFromState(session)
      : null;

    return {
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      dhPublicKey,
      messageNumber: session.sendMessageNumber - 1,
      previousChainLength: session.previousChainLength,
    };
  }

  /**
   * Decrypt message from a sender
   */
  async decryptMessageFromSender(
    senderId,
    ciphertext,
    nonce,
    dhPublicKey,
    messageNumber,
    previousChainLength
  ) {
    let session = this.sessions.get(senderId);

    if (!session) {
      throw new Error(`No session established with ${senderId}`);
    }

    // If we received a new DH public key, ratchet receiving chain
    if (dhPublicKey && dhPublicKey !== session.theirPublicKey) {
      await session.handleReceivedPublicKey(dhPublicKey);
      
      // Also initialize new sending chain
      await session.initializeSendingChain(dhPublicKey);
    }

    // Step receiving chain to get message key
    // Handle out-of-order messages (simplified - in production, need proper handling)
    while (session.receiveMessageNumber < messageNumber) {
      await session.stepReceivingChain();
    }

    const messageKey = await session.stepReceivingChain();

    // Decrypt message using the same associated data convention (order-independent)
    const ad = SessionManager.computeConversationAssociatedData(senderId, this.userId);
    const plaintext = await decryptMessage(messageKey, ciphertext, nonce, ad);

    return plaintext;
  }

  /**
   * Get public key from state (helper)
   */
  async getPublicKeyFromState(session) {
    if (!session.dhRatchetKeyPair) return null;
    const _sodium = await import("libsodium-wrappers");
    await _sodium.default.ready;
    return _sodium.default.to_base64(session.dhRatchetKeyPair.publicKey, _sodium.default.base64_variants.ORIGINAL);
  }

  /**
   * Get safety number for a recipient
   */
  getSafetyNumber(recipientId) {
    return this.safetyNumbers.get(recipientId);
  }

  /**
   * Verify safety number
   */
  verifySafetyNumber(recipientId, expectedSafetyNumber) {
    const actual = this.safetyNumbers.get(recipientId);
    return actual && actual.raw === expectedSafetyNumber;
  }

  /**
   * Compute deterministic associated data from two participant identifiers.
   * Sort the IDs, join with a delimiter, then take the first half of the string.
   * This creates a stable value both sides can derive independently.
   */
  static computeConversationAssociatedData(idA, idB) {
    const canonical = [String(idA), String(idB)].sort().join("|");
    const halfLen = Math.ceil(canonical.length / 2);
    return canonical.slice(0, halfLen);
  }

  /**
   * Save sessions to localStorage
   */
  saveSessions() {
    const sessionsData = {};
    for (const [recipientId, session] of this.sessions.entries()) {
      sessionsData[recipientId] = session.serialize();
    }
    localStorage.setItem(`sessions_${this.userId}`, JSON.stringify(sessionsData));
    
    const safetyNumbersData = {};
    for (const [recipientId, safetyNumber] of this.safetyNumbers.entries()) {
      safetyNumbersData[recipientId] = safetyNumber;
    }
    localStorage.setItem(`safetyNumbers_${this.userId}`, JSON.stringify(safetyNumbersData));
  }

  /**
   * Load sessions from localStorage
   */
  async loadSessions() {
    const sessionsDataStr = localStorage.getItem(`sessions_${this.userId}`);
    if (sessionsDataStr) {
      const sessionsData = JSON.parse(sessionsDataStr);
      for (const [recipientId, data] of Object.entries(sessionsData)) {
        const session = await DoubleRatchetState.deserialize(data);
        this.sessions.set(recipientId, session);
      }
    }

    const safetyNumbersDataStr = localStorage.getItem(`safetyNumbers_${this.userId}`);
    if (safetyNumbersDataStr) {
      const safetyNumbersData = JSON.parse(safetyNumbersDataStr);
      for (const [recipientId, safetyNumber] of Object.entries(safetyNumbersData)) {
        this.safetyNumbers.set(recipientId, safetyNumber);
      }
    }
  }
}

/**
 * Device Key Manager - Handles device key storage and retrieval
 */
export class DeviceKeyManager {
  constructor() {
    this.keys = null;
  }

  /**
   * Load or generate device keys
   */
  async loadOrGenerateKeys() {
    const stored = localStorage.getItem("deviceKeys");
    if (stored) {
      this.keys = JSON.parse(stored);
      return this.keys;
    }

    // Generate new keys
    const { generateDeviceKeys } = await import("./crypto.js");
    this.keys = await generateDeviceKeys();
    localStorage.setItem("deviceKeys", JSON.stringify(this.keys));
    return this.keys;
  }

  /**
   * Get device keys
   */
  getKeys() {
    return this.keys;
  }

  /**
   * Get public key bundle for sharing
   */
  getPublicKeyBundle() {
    if (!this.keys) return null;
    return {
      identityPublicKey: this.keys.identityPublicKey,
      keyAgreementPublicKey: this.keys.keyAgreementPublicKey,
      signedPrekey: this.keys.signedPrekey,
      signedPrekeySignature: this.keys.signedPrekeySignature,
      oneTimePrekeys: this.keys.oneTimePrekeys.slice(0, 10), // Send first 10
    };
  }

  /**
   * Rotate keys (generate new signed prekey and one-time prekeys)
   */
  async rotateKeys() {
    const { generateDeviceKeys } = await import("./crypto.js");
    const newKeys = await generateDeviceKeys();
    
    // Keep identity keys, update prekeys
    this.keys.signedPrekey = newKeys.signedPrekey;
    this.keys.signedPrekeySignature = newKeys.signedPrekeySignature;
    this.keys.oneTimePrekeys = newKeys.oneTimePrekeys;
    this.keys.createdAt = newKeys.createdAt;
    
    localStorage.setItem("deviceKeys", JSON.stringify(this.keys));
    return this.keys;
  }
}

