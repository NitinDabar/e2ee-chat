import React, { useState } from "react";
import { generateKeyPair, encryptMessage, decryptMessage } from "../utils/crypto";

export default function CryptoTest() {
  const [keys, setKeys] = useState({});
  const [plain, setPlain] = useState("");
  const [encrypted, setEncrypted] = useState("");
  const [decrypted, setDecrypted] = useState("");

  const handleGenerate = async () => {
    const kp = await generateKeyPair();
    setKeys(kp);
  };

  const handleEncrypt = async () => {
    if (!keys.publicKey) return alert("Generate keys first");
    const enc = await encryptMessage(keys.publicKey, plain);
    setEncrypted(enc);
  };

  const handleDecrypt = async () => {
    if (!keys.privateKey) return alert("Generate keys first");
    const dec = await decryptMessage(keys.privateKey, encrypted);
    setDecrypted(dec);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Crypto Test</h2>
      <button onClick={handleGenerate}>Generate Key Pair</button>
      <div>
        <textarea
          placeholder="Enter message"
          value={plain}
          onChange={e => setPlain(e.target.value)}
        />
      </div>
      <button onClick={handleEncrypt}>Encrypt</button>
      <div>
        <textarea value={encrypted} readOnly placeholder="Encrypted output" />
      </div>
      <button onClick={handleDecrypt}>Decrypt</button>
      <div>
        <textarea value={decrypted} readOnly placeholder="Decrypted output" />
      </div>
    </div>
  );
}
