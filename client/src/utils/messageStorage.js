/**
 * Local message storage using localStorage
 * Stores decrypted messages locally for faster access
 */

export const saveMessage = (userId, recipientId, message) => {
  try {
    const conversationId = [userId, recipientId].sort().join("_");
    const key = `messages_${conversationId}`;
    
    const existing = localStorage.getItem(key);
    const messages = existing ? JSON.parse(existing) : [];
    
    // Add message if not already exists
    const messageExists = messages.some((m) => m._id === message._id);
    if (!messageExists) {
      messages.push({
        ...message,
        plaintext: message.plaintext || message.content,
        timestamp: message.createdAt || new Date().toISOString(),
      });
      
      // Sort by timestamp
      messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Keep only last 1000 messages per conversation
      if (messages.length > 1000) {
        messages.splice(0, messages.length - 1000);
      }
      
      localStorage.setItem(key, JSON.stringify(messages));
    }
    
    return true;
  } catch (err) {
    console.error("Failed to save message locally:", err);
    return false;
  }
};

export const getMessages = (userId, recipientId) => {
  try {
    const conversationId = [userId, recipientId].sort().join("_");
    const key = `messages_${conversationId}`;
    
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.error("Failed to get messages from local storage:", err);
    return [];
  }
};

export const saveConversation = (userId, recipientId, conversationData) => {
  try {
    const key = `conversations_${userId}`;
    const existing = localStorage.getItem(key);
    const conversations = existing ? JSON.parse(existing) : [];
    
    const existingIndex = conversations.findIndex((c) => c.userId === recipientId);
    const conversation = {
      userId: recipientId,
      lastMessage: conversationData.lastMessage,
      updatedAt: new Date().toISOString(),
    };
    
    if (existingIndex >= 0) {
      conversations[existingIndex] = conversation;
    } else {
      conversations.push(conversation);
    }
    
    // Sort by updatedAt
    conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    localStorage.setItem(key, JSON.stringify(conversations));
    return true;
  } catch (err) {
    console.error("Failed to save conversation:", err);
    return false;
  }
};

export const clearMessages = (userId, recipientId) => {
  try {
    const conversationId = [userId, recipientId].sort().join("_");
    const key = `messages_${conversationId}`;
    localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.error("Failed to clear messages:", err);
    return false;
  }
};

