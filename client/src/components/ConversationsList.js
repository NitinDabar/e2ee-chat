import { useState, useEffect } from "react";
import { getEncryptedMessages } from "../api/api";

const ConversationsList = ({ onSelectConversation, currentUserId, searchQuery = "" }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, [currentUserId]);

  useEffect(() => {
    // Filter conversations when search query changes
    if (searchQuery) {
      // This will be handled by filtering in the render
    }
  }, [searchQuery]);

  const loadConversations = async () => {
    try {
      // Get all messages to build conversation list
      const { data: messages } = await getEncryptedMessages();
      
      // Group messages by conversation partner
      const conversationMap = new Map();
      
      messages.forEach((msg) => {
        const partnerId = msg.senderId === currentUserId ? msg.recipientId : msg.senderId;
        
        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            userId: partnerId,
            lastMessage: msg,
            unreadCount: 0,
            messages: [],
          });
        }
        
        const conv = conversationMap.get(partnerId);
        conv.messages.push(msg);
        
        // Update last message if this is newer
        if (new Date(msg.createdAt) > new Date(conv.lastMessage.createdAt)) {
          conv.lastMessage = msg;
        }
        
        // Count unread (simplified - in production would check read status)
        if (msg.recipientId === currentUserId && !msg.read) {
          conv.unreadCount++;
        }
      });

      // Convert to array and sort by last message time
      const conversationsArray = Array.from(conversationMap.values()).sort(
        (a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
      );

      setConversations(conversationsArray);
      
      // Load from local storage as well
      loadLocalConversations();
    } catch (err) {
      console.error("Failed to load conversations:", err);
      loadLocalConversations();
    } finally {
      setLoading(false);
    }
  };

  const loadLocalConversations = () => {
    try {
      const localConversations = localStorage.getItem(`conversations_${currentUserId}`);
      if (localConversations) {
        const parsed = JSON.parse(localConversations);
        // Merge with existing conversations
        setConversations((prev) => {
          const merged = [...prev];
          parsed.forEach((localConv) => {
            const existing = merged.find((c) => c.userId === localConv.userId);
            if (!existing) {
              merged.push(localConv);
            }
          });
          return merged;
        });
      }
    } catch (err) {
      console.error("Failed to load local conversations:", err);
    }
  };

  if (loading) {
    return <div className="conversations-loading">Loading conversations...</div>;
  }

  return (
    <div className="conversations-list">
      <div className="conversations-header">
        <h3>Conversations</h3>
        <button className="new-chat-btn" onClick={() => onSelectConversation(null, true)} title="New Chat">
          +
        </button>
      </div>
      
      {conversations.length === 0 ? (
        <div className="no-conversations">
          <p className="conversations-placeholder">Your chats will appear here.</p>
        </div>
      ) : (
        <div className="conversations-items">
          {conversations
            .filter((conv) => {
              if (!searchQuery) return true;
              const searchLower = searchQuery.toLowerCase();
              return conv.userId.toLowerCase().includes(searchLower);
            })
            .map((conv) => (
            <div
              key={conv.userId}
              className="conversation-item"
              onClick={() => onSelectConversation(conv.userId)}
              title={`Chat with ${conv.userId.substring(0, 8)}`}
            >
              <div className="conversation-avatar">
                {conv.userId.substring(0, 2).toUpperCase()}
              </div>
              <div className="conversation-info">
                <div className="conversation-header-row">
                  <span className="conversation-name">User {conv.userId.substring(0, 8)}</span>
                  <span className="conversation-time">
                    {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="conversation-preview">
                  <span className="preview-text">Encrypted message</span>
                  {conv.unreadCount > 0 && (
                    <span className="unread-badge">{conv.unreadCount}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConversationsList;

