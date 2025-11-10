import { useState } from "react";
import ConversationsList from "./ConversationsList";

const Sidebar = ({ onSelectConversation, currentUserId, user, onLogout }) => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="modern-sidebar">
      {/* Top Header */}
      <div className="sidebar-top">
        <h1 className="sidebar-title">🔒 E2EE Chat</h1>
        <button 
          className="new-conversation-btn"
          onClick={() => onSelectConversation(null, true)}
        >
          ➕ New Conversation
        </button>
      </div>

      {/* Search Bar */}
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="🔍 Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Conversations List */}
      <div className="sidebar-conversations">
        <ConversationsList
          onSelectConversation={onSelectConversation}
          currentUserId={currentUserId}
          searchQuery={searchQuery}
        />
      </div>

      {/* User Profile Section */}
      <div className="sidebar-profile">
        <div className="user-avatar-small">
          {user?.username?.substring(0, 2).toUpperCase() || "U"}
        </div>
        <div className="user-info-small">
          <span className="user-name-small">{user?.username || "User"}</span>
        </div>
        <button className="settings-btn" onClick={onLogout} title="Logout">
          ⚙️
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

