import { useEffect, useState, useCallback } from "react";
import { sendEncryptedMessage, getEncryptedMessages, getUserKeyBundle, deleteConversation, blockUser } from "../api/api";
import { useNavigate } from "react-router-dom";
import { SessionManager } from "../utils/sessionManager.js";
import { DeviceKeyManager } from "../utils/sessionManager.js";
import { getOrCreateDeviceId } from "../utils/deviceId.js";
import { uploadDeviceKeys } from "../api/api";
import Sidebar from "../components/Sidebar.js";
import WelcomeScreen from "../components/WelcomeScreen.js";
import { saveMessage, getMessages as getLocalMessages, saveConversation } from "../utils/messageStorage.js";

const Chat = () => {
  const [selectedRecipientId, setSelectedRecipientId] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatRecipientId, setNewChatRecipientId] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [user, setUser] = useState(null);
  const [sessionManager, setSessionManager] = useState(null);
  const [deviceKeyManager, setDeviceKeyManager] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();

  // Initialize encryption on mount
  useEffect(() => {
    const initializeEncryption = async () => {
      try {
        const token = localStorage.getItem("token");
        const userData = localStorage.getItem("user");
        
        if (!token || !userData) {
          navigate("/");
          return;
        }

        const userObj = JSON.parse(userData);
        setUser(userObj);

        // Get or create device ID
        const devId = getOrCreateDeviceId();
        setDeviceId(devId);

        // Initialize device keys
        const dkm = new DeviceKeyManager();
        const deviceKeys = await dkm.loadOrGenerateKeys();
        setDeviceKeyManager(dkm);

        // Upload device keys to server
        const publicBundle = dkm.getPublicKeyBundle();
        await uploadDeviceKeys({
          deviceId: devId,
          deviceName: navigator.userAgent.substring(0, 50),
          ...publicBundle,
          oneTimePrekeys: deviceKeys.oneTimePrekeys.slice(0, 100),
        });

        // Initialize session manager
        const sm = new SessionManager(userObj.id, deviceKeys);
        await sm.loadSessions();
        setSessionManager(sm);

        setInitializing(false);
      } catch (err) {
        console.error("Failed to initialize encryption:", err);
        setError("Failed to initialize encryption. Please refresh.");
      }
    };

    initializeEncryption();
  }, [navigate]);

  // Load messages for selected recipient
  useEffect(() => {
    if (selectedRecipientId && sessionManager && user) {
      loadMessages(selectedRecipientId);
    }
  }, [selectedRecipientId, sessionManager, user]);

  const loadMessages = async (recipientId) => {
    if (!sessionManager || !deviceId || !user) return;

    try {
      // Load from local storage first (fast)
      const localMessages = getLocalMessages(user.id, recipientId);
      if (localMessages.length > 0) {
        setMessages(localMessages);
      }

      // Fetch from server and decrypt
      const { data: encryptedMessages } = await getEncryptedMessages(recipientId, deviceId);
      
      const decrypted = [];
      for (const msg of encryptedMessages) {
        try {
          let plaintext;
          if (msg.senderId === user.id) {
            // Message we sent - get from local storage or decrypt
            const localMsg = localMessages.find((m) => m._id === msg._id);
            plaintext = localMsg?.plaintext || "[Sent message]";
          } else {
            // Message we received - decrypt
            plaintext = await sessionManager.decryptMessageFromSender(
              msg.senderId,
              msg.ciphertext,
              msg.nonce,
              msg.dhPublicKey,
              msg.messageNumber,
              msg.previousChainLength
            );
          }
          
          const decryptedMsg = {
            ...msg,
            plaintext,
            isSent: msg.senderId === user.id,
          };

          // Save to local storage
          saveMessage(user.id, recipientId, decryptedMsg);
          decrypted.push(decryptedMsg);
        } catch (err) {
          console.error("Failed to decrypt message:", err);
          decrypted.push({
            ...msg,
            plaintext: "[Decryption failed]",
            isSent: msg.senderId === user.id,
            error: true,
          });
        }
      }

      // Sort by timestamp
      decrypted.sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp));
      setMessages(decrypted);
      
      // Save session state
      sessionManager.saveSessions();
    } catch (err) {
      console.error("Failed to load messages:", err);
      setError("Failed to load messages");
    }
  };

  // Establish session with recipient
  const establishSession = useCallback(async (recipientUserId) => {
    if (!sessionManager || !deviceKeyManager) return;

    try {
      // Get recipient's key bundle
      const { data: bundle } = await getUserKeyBundle(recipientUserId);
      
      if (!bundle.devices || bundle.devices.length === 0) {
        throw new Error("Recipient has no devices registered");
      }

      // Use first device for now
      const theirDevice = bundle.devices[0];

      // Initialize session
      await sessionManager.initializeSession(
        recipientUserId,
        theirDevice.identityPublicKey,
        theirDevice.signedPrekey,
        theirDevice.signedPrekeySignature,
        theirDevice.oneTimePrekeys?.[0] || null
      );

      sessionManager.saveSessions();
      return true;
    } catch (err) {
      console.error("Failed to establish session:", err);
      setError(`Failed to establish secure session: ${err.message}`);
      return false;
    }
  }, [sessionManager, deviceKeyManager]);

  // Handle sending message (auto-encrypts)
  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !selectedRecipientId || !sessionManager || sending) {
      return;
    }

    const plaintext = text.trim();
    setText("");
    setSending(true);
    setError("");

    try {
      // Check if session exists, if not establish it
      if (!sessionManager.sessions.has(selectedRecipientId)) {
        const sessionEstablished = await establishSession(selectedRecipientId);
        if (!sessionEstablished) {
          setText(plaintext); // Restore text
          setSending(false);
          return;
        }
      }

      // Encrypt message (transparent to user)
      const timestamp = new Date().toISOString();
      const encrypted = await sessionManager.encryptMessageForRecipient(
        selectedRecipientId,
        plaintext,
        user.id,
        selectedRecipientId,
        timestamp
      );

      // Send encrypted message
      const { data } = await sendEncryptedMessage({
        recipientId: selectedRecipientId,
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        dhPublicKey: encrypted.dhPublicKey,
        messageNumber: encrypted.messageNumber,
        previousChainLength: encrypted.previousChainLength,
        senderDeviceId: deviceId,
        type: "text",
      });

      // Save session state
      sessionManager.saveSessions();

      // Add to local messages immediately (optimistic update)
      const newMessage = {
        _id: data.id || Date.now().toString(),
        senderId: user.id,
        recipientId: selectedRecipientId,
        plaintext: plaintext, // Store plaintext locally
        isSent: true,
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      };

      saveMessage(user.id, selectedRecipientId, newMessage);
      saveConversation(user.id, selectedRecipientId, { lastMessage: newMessage });

      // Update UI
      setMessages((prev) => [...prev, newMessage]);

      // Refresh messages from server
      setTimeout(() => loadMessages(selectedRecipientId), 500);
    } catch (err) {
      console.error("Failed to send message:", err);
      setError(`Failed to send message: ${err.message}`);
      setText(plaintext); // Restore text on error
    } finally {
      setSending(false);
    }
  };

  // Handle selecting a conversation
  const handleSelectConversation = async (recipientId, isNew = false) => {
    if (isNew) {
      setShowNewChat(true);
      setSelectedRecipientId(null);
      setMessages([]);
    } else if (recipientId) {
      setSelectedRecipientId(recipientId);
      setShowNewChat(false);
      // Proactively establish session in background
      try { await establishSession(recipientId); } catch (_) {}
    }
  };

  // Handle starting new chat
  const handleStartNewChat = async (username) => {
    if (!username || !username.trim()) {
      setError("Please enter a username");
      return;
    }

    const recipientId = username.trim();
    
    // Establish session
    const sessionEstablished = await establishSession(recipientId);
    if (sessionEstablished) {
      setSelectedRecipientId(recipientId);
      setShowNewChat(false);
      setNewChatRecipientId("");
      setError("");
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  if (initializing) {
    return (
      <div className="chat-page">
        <div className="initializing">
          <h2>Initializing Secure Chat...</h2>
          <p>Setting up encryption keys...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <div className="chat-layout">
        {/* Modern Sidebar */}
        <Sidebar
          onSelectConversation={handleSelectConversation}
          currentUserId={user?.id}
          user={user}
          onLogout={handleLogout}
        />

        {/* Main Chat Area */}
        <div className="chat-main">
          {selectedRecipientId ? (
            <>
              <div className="chat-header">
                <div className="chat-header-left">
                  <div className="chat-header-avatar">
                    {selectedRecipientId.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="chat-header-info">
                    <h3>User {selectedRecipientId.substring(0, 8)}</h3>
                    <div className="chat-header-status">
                      {sessionManager?.sessions.has(selectedRecipientId) ? (
                        <span className="session-status">Encrypted</span>
                      ) : (
                        <span>Connecting...</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {error && <div className="error" style={{ padding: "0.5rem 1rem", background: "#ffebee", color: "#c62828" }}>{error}</div>}

              <div className="messages-container">
                {messages.length === 0 ? (
                  <div className="no-messages">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((m, index) => {
                    const prevMessage = index > 0 ? messages[index - 1] : null;
                    const showTime = !prevMessage || 
                      new Date(m.createdAt || m.timestamp).getTime() - new Date(prevMessage.createdAt || prevMessage.timestamp).getTime() > 300000; // 5 minutes
                    
                    return (
                      <div key={m._id}>
                        {showTime && (
                          <div style={{ textAlign: "center", margin: "0.5rem 0", fontSize: "0.75rem", color: "#667781" }}>
                            {new Date(m.createdAt || m.timestamp).toLocaleDateString()} {new Date(m.createdAt || m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        <div
                          className={`message-bubble ${m.isSent ? "sent" : "received"} ${m.error ? "error" : ""}`}
                        >
                          <div className="message-content">
                            <p className="message-text">{m.plaintext}</p>
                            <div className="message-time">
                              <span>
                                {new Date(m.createdAt || m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {m.isSent && (
                                <span className="message-status delivered"></span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="chat-actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button type="button" onClick={async ()=>{ try { await deleteConversation(selectedRecipientId); setMessages([]);} catch(e){ console.error(e);} }} disabled={!selectedRecipientId} title="Delete conversation">🗑️</button>
                <button type="button" onClick={async ()=>{ try { await blockUser(selectedRecipientId);} catch(e){ console.error(e);} }} disabled={!selectedRecipientId} title="Block user">🚫</button>
              </div>
              <form className="message-input-form" onSubmit={handleSend}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={selectedRecipientId ? "Type a message..." : "Select a conversation to start chatting"}
                  disabled={sending || !selectedRecipientId}
                />
                <button 
                  type="submit" 
                  disabled={sending || !text.trim() || !selectedRecipientId}
                  title={sending ? "Sending..." : "Send message"}
                >
                </button>
              </form>
            </>
          ) : (
            <WelcomeScreen onStartChat={handleStartNewChat} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
