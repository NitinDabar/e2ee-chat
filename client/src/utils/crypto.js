import _sodium from "libsodium-wrappers";

let sodiumReady = false;

// Initialize libsodium
export const initSodium = async () => {
  if (sodiumReady) return;
  await _sodium.ready;
  sodiumReady = true;
};

// Ensure sodium is initialized before use
const ensureReady = async () => {
  if (!sodiumReady) await initSodium();
};

// ============================================================================
// IDENTITY & DEVICE KEYS
// ============================================================================

/**
 * Generate Ed25519 identity key pair (for signing)
 */
export const generateIdentityKeyPair = async () => {
  await ensureReady();
  const keyPair = _sodium.crypto_sign_keypair();
  return {
    identityPublicKey: _sodium.to_base64(keyPair.publicKey, _sodium.base64_variants.ORIGINAL),
    identityPrivateKey: _sodium.to_base64(keyPair.privateKey, _sodium.base64_variants.ORIGINAL),
  };
};

/**
 * Generate Curve25519/X25519 key pair (for key agreement)
 */
export const generateKeyAgreementKeyPair = async () => {
  await ensureReady();
  const keyPair = _sodium.crypto_box_keypair();
  return {
    keyAgreementPublicKey: _sodium.to_base64(keyPair.publicKey, _sodium.base64_variants.ORIGINAL),
    keyAgreementPrivateKey: _sodium.to_base64(keyPair.privateKey, _sodium.base64_variants.ORIGINAL),
  };
};

/**
 * Generate device key bundle (identity + key agreement + prekeys)
 */
export const generateDeviceKeys = async () => {
  await ensureReady();
  const [identityKeys, keyAgreementKeys] = await Promise.all([
    generateIdentityKeyPair(),
    generateKeyAgreementKeyPair(),
  ]);

  // Generate signed prekey (one-time signature)
  const signedPrekeyPair = await generateKeyAgreementKeyPair();
  const signedPrekeySignature = _sodium.crypto_sign_detached(
    _sodium.from_base64(signedPrekeyPair.keyAgreementPublicKey, _sodium.base64_variants.ORIGINAL),
    _sodium.from_base64(identityKeys.identityPrivateKey, _sodium.base64_variants.ORIGINAL)
  );

  // Generate one-time prekeys (OPK)
  const oneTimePrekeys = [];
  for (let i = 0; i < 100; i++) {
    const opk = await generateKeyAgreementKeyPair();
    oneTimePrekeys.push(opk.keyAgreementPublicKey);
  }

  return {
    ...identityKeys,
    ...keyAgreementKeys,
    signedPrekey: signedPrekeyPair.keyAgreementPublicKey,
    signedPrekeySignature: _sodium.to_base64(signedPrekeySignature, _sodium.base64_variants.ORIGINAL),
    oneTimePrekeys,
    createdAt: new Date().toISOString(),
  };
};

/**
 * Sign data with identity key
 */
export const sign = async (data, identityPrivateKey) => {
  await ensureReady();
  const dataBytes = typeof data === "string" ? _sodium.from_string(data) : data;
  const privateKeyBytes = _sodium.from_base64(identityPrivateKey, _sodium.base64_variants.ORIGINAL);
  const signature = _sodium.crypto_sign_detached(dataBytes, privateKeyBytes);
  return _sodium.to_base64(signature, _sodium.base64_variants.ORIGINAL);
};

/**
 * Verify signature with identity public key
 */
export const verify = async (data, signature, identityPublicKey) => {
  await ensureReady();
  const dataBytes = typeof data === "string" ? _sodium.from_string(data) : data;
  const signatureBytes = _sodium.from_base64(signature, _sodium.base64_variants.ORIGINAL);
  const publicKeyBytes = _sodium.from_base64(identityPublicKey, _sodium.base64_variants.ORIGINAL);
  return _sodium.crypto_sign_verify_detached(signatureBytes, dataBytes, publicKeyBytes);
};

// ============================================================================
// X3DH SESSION ESTABLISHMENT
// ============================================================================

/**
 * X3DH key agreement (simplified version)
 * Returns shared secret derived from identity keys and prekeys
 */
export const x3dhKeyAgreement = async (
  myIdentityPrivateKey,
  myKeyAgreementPrivateKey,
  theirIdentityPublicKey,
  theirSignedPrekeyPublicKey,
  theirSignedPrekeySignature,
  theirOneTimePrekeyPublicKey = null
) => {
  await ensureReady();

  // Verify signed prekey signature
  const theirSignedPrekeyBytes = _sodium.from_base64(theirSignedPrekeyPublicKey, _sodium.base64_variants.ORIGINAL);
  const signatureBytes = _sodium.from_base64(theirSignedPrekeySignature, _sodium.base64_variants.ORIGINAL);
  const theirIdentityPubBytes = _sodium.from_base64(theirIdentityPublicKey, _sodium.base64_variants.ORIGINAL);
  
  if (!_sodium.crypto_sign_verify_detached(signatureBytes, theirSignedPrekeyBytes, theirIdentityPubBytes)) {
    throw new Error("Invalid signed prekey signature");
  }

  // Perform X3DH: DH(IK_A, SPK_B) || DH(EK_A, IK_B) || DH(EK_A, SPK_B) || DH(EK_A, OPK_B)
  const myIdentityPrivateBytes = _sodium.from_base64(myIdentityPrivateKey, _sodium.base64_variants.ORIGINAL);
  const myKeyAgreementPrivateBytes = _sodium.from_base64(myKeyAgreementPrivateKey, _sodium.base64_variants.ORIGINAL);
  
  const theirOneTimePrekeyBytes = theirOneTimePrekeyPublicKey 
    ? _sodium.from_base64(theirOneTimePrekeyPublicKey, _sodium.base64_variants.ORIGINAL)
    : null;

  // DH1: IK_A · SPK_B (convert identity key to curve25519)
  const myIdentityCurve25519 = _sodium.crypto_sign_ed25519_sk_to_curve25519(myIdentityPrivateBytes);
  const dh1 = _sodium.crypto_scalarmult(myIdentityCurve25519, theirSignedPrekeyBytes);
  
  // DH2: EK_A · IK_B (using key agreement key)
  const theirIdentityCurve25519 = _sodium.crypto_sign_ed25519_pk_to_curve25519(theirIdentityPubBytes);
  const dh2 = _sodium.crypto_scalarmult(myKeyAgreementPrivateBytes, theirIdentityCurve25519);
  
  // DH3: EK_A · SPK_B
  const dh3 = _sodium.crypto_scalarmult(myKeyAgreementPrivateBytes, theirSignedPrekeyBytes);
  
  // DH4: EK_A · OPK_B (if available)
  let dh4 = new Uint8Array(32).fill(0);
  if (theirOneTimePrekeyBytes) {
    dh4 = _sodium.crypto_scalarmult(myKeyAgreementPrivateBytes, theirOneTimePrekeyBytes);
  }

  // Concatenate and derive shared secret
  const combined = new Uint8Array([...dh1, ...dh2, ...dh3, ...dh4]);
  const sharedSecret = _sodium.crypto_generichash(32, combined);
  
  return _sodium.to_base64(sharedSecret, _sodium.base64_variants.ORIGINAL);
};

// ============================================================================
// DOUBLE RATCHET (HKDF CHAINS)
// ============================================================================

/**
 * HKDF key derivation
 */
const hkdf = (salt, inputKeyMaterial, info, outputLength = 32) => {
  const prk = _sodium.crypto_generichash(32, inputKeyMaterial, salt);
  const infoBytes = typeof info === "string" ? _sodium.from_string(info) : info;
  const okm = _sodium.crypto_generichash(outputLength, infoBytes, prk);
  return okm;
};

/**
 * Double Ratchet State
 */
export class DoubleRatchetState {
  constructor(rootKey, theirPublicKey = null) {
    this.rootKey = rootKey;
    this.theirPublicKey = theirPublicKey;
    this.dhRatchetKeyPair = null;
    this.sendChainKey = null;
    this.receiveChainKey = null;
    this.sendMessageNumber = 0;
    this.receiveMessageNumber = 0;
    this.previousChainLength = 0;
  }

  /**
   * Initialize sending chain
   */
  async initializeSendingChain(theirPublicKey) {
    await ensureReady();
    this.theirPublicKey = theirPublicKey;
    
    // Generate new DH key pair for sending
    this.dhRatchetKeyPair = _sodium.crypto_box_keypair();
    
    // Perform DH to get shared secret
    const sharedSecret = _sodium.crypto_scalarmult(
      this.dhRatchetKeyPair.privateKey,
      _sodium.from_base64(theirPublicKey, _sodium.base64_variants.ORIGINAL)
    );
    
    // Derive new root key and chain key
    const rootKeyMaterial = hkdf(
      this.rootKey,
      sharedSecret,
      "RootKey"
    );
    const chainKeyMaterial = hkdf(
      this.rootKey,
      sharedSecret,
      "ChainKey"
    );
    
    this.rootKey = _sodium.to_base64(rootKeyMaterial, _sodium.base64_variants.ORIGINAL);
    this.sendChainKey = _sodium.to_base64(chainKeyMaterial, _sodium.base64_variants.ORIGINAL);
    this.sendMessageNumber = 0;
  }

  /**
   * Step sending chain (ratchet forward)
   */
  async stepSendingChain() {
    await ensureReady();
    if (!this.sendChainKey) throw new Error("Sending chain not initialized");
    
    const chainKeyBytes = _sodium.from_base64(this.sendChainKey, _sodium.base64_variants.ORIGINAL);
    const messageKeyMaterial = hkdf(chainKeyBytes, new Uint8Array([0x01]), "MessageKey", 32);
    const nextChainKeyMaterial = hkdf(chainKeyBytes, new Uint8Array([0x02]), "ChainKey", 32);
    
    this.sendChainKey = _sodium.to_base64(nextChainKeyMaterial, _sodium.base64_variants.ORIGINAL);
    this.sendMessageNumber++;
    
    return _sodium.to_base64(messageKeyMaterial, _sodium.base64_variants.ORIGINAL);
  }

  /**
   * Step receiving chain (ratchet forward)
   */
  async stepReceivingChain() {
    await ensureReady();
    if (!this.receiveChainKey) throw new Error("Receiving chain not initialized");
    
    const chainKeyBytes = _sodium.from_base64(this.receiveChainKey, _sodium.base64_variants.ORIGINAL);
    const messageKeyMaterial = hkdf(chainKeyBytes, new Uint8Array([0x01]), "MessageKey", 32);
    const nextChainKeyMaterial = hkdf(chainKeyBytes, new Uint8Array([0x02]), "ChainKey", 32);
    
    this.receiveChainKey = _sodium.to_base64(nextChainKeyMaterial, _sodium.base64_variants.ORIGINAL);
    this.receiveMessageNumber++;
    
    return _sodium.to_base64(messageKeyMaterial, _sodium.base64_variants.ORIGINAL);
  }

  /**
   * Handle received DH public key (ratchet receiving chain)
   */
  async handleReceivedPublicKey(theirPublicKey) {
    await ensureReady();
    
    // Save previous chain length
    this.previousChainLength = this.receiveMessageNumber;
    this.receiveMessageNumber = 0;
    
    // Generate new DH key pair
    this.dhRatchetKeyPair = _sodium.crypto_box_keypair();
    
    // Perform DH
    const sharedSecret = _sodium.crypto_scalarmult(
      this.dhRatchetKeyPair.privateKey,
      _sodium.from_base64(theirPublicKey, _sodium.base64_variants.ORIGINAL)
    );
    
    // Derive new root key and receiving chain key
    const rootKeyBytes = _sodium.from_base64(this.rootKey, _sodium.base64_variants.ORIGINAL);
    const rootKeyMaterial = hkdf(rootKeyBytes, sharedSecret, "RootKey");
    const chainKeyMaterial = hkdf(rootKeyBytes, sharedSecret, "ChainKey");
    
    this.rootKey = _sodium.to_base64(rootKeyMaterial, _sodium.base64_variants.ORIGINAL);
    this.receiveChainKey = _sodium.to_base64(chainKeyMaterial, _sodium.base64_variants.ORIGINAL);
  }

  /**
   * Serialize state for storage
   */
  serialize() {
    return {
      rootKey: this.rootKey,
      theirPublicKey: this.theirPublicKey,
      dhRatchetPublicKey: this.dhRatchetKeyPair
        ? _sodium.to_base64(this.dhRatchetKeyPair.publicKey, _sodium.base64_variants.ORIGINAL)
        : null,
      sendChainKey: this.sendChainKey,
      receiveChainKey: this.receiveChainKey,
      sendMessageNumber: this.sendMessageNumber,
      receiveMessageNumber: this.receiveMessageNumber,
      previousChainLength: this.previousChainLength,
    };
  }

  /**
   * Deserialize state from storage
   */
  static async deserialize(data) {
    await ensureReady();
    const state = new DoubleRatchetState(data.rootKey, data.theirPublicKey);
    state.sendChainKey = data.sendChainKey;
    state.receiveChainKey = data.receiveChainKey;
    state.sendMessageNumber = data.sendMessageNumber;
    state.receiveMessageNumber = data.receiveMessageNumber;
    state.previousChainLength = data.previousChainLength;
    
    if (data.dhRatchetPublicKey) {
      // Reconstruct key pair (we only store public key, private key is ephemeral)
      // In practice, we'd need to store the private key securely
      state.dhRatchetKeyPair = null; // Will be regenerated on next ratchet
    }
    
    return state;
  }
}

// ============================================================================
// MESSAGE ENCRYPTION/DECRYPTION
// ============================================================================

/**
 * Encrypt message with AEAD (XChaCha20-Poly1305)
 */
export const encryptMessage = async (
  messageKey,
  plaintext,
  associatedData = null
) => {
  await ensureReady();
  
  const messageKeyBytes = _sodium.from_base64(messageKey, _sodium.base64_variants.ORIGINAL);
  const plaintextBytes = typeof plaintext === "string" 
    ? _sodium.from_string(plaintext) 
    : plaintext;
  
  // Generate random nonce
  const nonce = _sodium.randombytes_buf(_sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  
  const ad = associatedData 
    ? (typeof associatedData === "string" ? _sodium.from_string(associatedData) : associatedData)
    : null;
  
  const ciphertext = _sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintextBytes,
    ad,
    null,
    nonce,
    messageKeyBytes
  );
  
  return {
    ciphertext: _sodium.to_base64(ciphertext, _sodium.base64_variants.ORIGINAL),
    nonce: _sodium.to_base64(nonce, _sodium.base64_variants.ORIGINAL),
  };
};

/**
 * Decrypt message with AEAD
 */
export const decryptMessage = async (
  messageKey,
  ciphertext,
  nonce,
  associatedData = null
) => {
  await ensureReady();
  
  const messageKeyBytes = _sodium.from_base64(messageKey, _sodium.base64_variants.ORIGINAL);
  const ciphertextBytes = _sodium.from_base64(ciphertext, _sodium.base64_variants.ORIGINAL);
  const nonceBytes = _sodium.from_base64(nonce, _sodium.base64_variants.ORIGINAL);
  
  const ad = associatedData 
    ? (typeof associatedData === "string" ? _sodium.from_string(associatedData) : associatedData)
    : null;
  
  const plaintext = _sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    ciphertextBytes,
    ad,
    nonceBytes,
    messageKeyBytes
  );
  
  return _sodium.to_string(plaintext);
};

// ============================================================================
// SAFETY NUMBER / VERIFICATION CODE
// ============================================================================

/**
 * Generate safety number for verification (SHA-256 of combined public keys)
 */
export const generateSafetyNumber = async (
  myIdentityPublicKey,
  mySignedPrekeyPublicKey,
  theirIdentityPublicKey,
  theirSignedPrekeyPublicKey
) => {
  await ensureReady();
  
  const combined = [
    myIdentityPublicKey,
    mySignedPrekeyPublicKey,
    theirIdentityPublicKey,
    theirSignedPrekeyPublicKey,
  ].sort().join("|");
  
  const hash = _sodium.crypto_generichash(32, _sodium.from_string(combined));
  const safetyNumber = _sodium.to_base64(hash, _sodium.base64_variants.ORIGINAL);
  
  // Format as 60-digit number (groups of 5)
  const numbers = Array.from(hash.slice(0, 30))
    .map((b) => (b % 10).toString())
    .join("");
  
  return {
    raw: safetyNumber,
    formatted: numbers.match(/.{1,5}/g)?.join(" ") || numbers,
  };
};

// ============================================================================
// KEY BACKUP / RESTORE (Argon2id)
// ============================================================================

/**
 * Derive backup key using Argon2id
 */
export const deriveBackupKey = async (password, salt) => {
  await ensureReady();
  // Note: libsodium-wrappers doesn't have Argon2, so we use a KDF approximation
  // In production, use a proper Argon2 implementation
  const passwordBytes = _sodium.from_string(password);
  const saltBytes = _sodium.from_base64(salt, _sodium.base64_variants.ORIGINAL);
  const key = _sodium.crypto_pwhash(
    32,
    passwordBytes,
    saltBytes,
    _sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    _sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    _sodium.crypto_pwhash_ALG_DEFAULT
  );
  return _sodium.to_base64(key, _sodium.base64_variants.ORIGINAL);
};

// Initialize on import
initSodium();
