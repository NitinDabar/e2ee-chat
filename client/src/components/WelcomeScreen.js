import { useState } from "react";

const WelcomeScreen = ({ onStartChat }) => {
  const [username, setUsername] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onStartChat(username.trim());
      setUsername("");
    }
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        {/* Illustration */}
        <div className="welcome-illustration">
          <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Shield */}
            <path
              d="M100 20L120 30V60C120 90 105 120 100 140C95 120 80 90 80 60V30L100 20Z"
              fill="#4ECDC4"
              opacity="0.3"
            />
            <path
              d="M100 25L115 33V60C115 85 103 110 100 125C97 110 85 85 85 60V33L100 25Z"
              fill="#4ECDC4"
            />
            {/* Lock */}
            <rect x="90" y="70" width="20" height="25" rx="2" fill="#1A535C" />
            <path d="M95 70V65C95 58 101 52 100 52C99 52 105 58 105 65V70" stroke="#1A535C" strokeWidth="2" fill="none" />
            {/* Message Bubble */}
            <ellipse cx="100" cy="140" rx="30" ry="20" fill="#1A535C" opacity="0.8" />
            <path
              d="M100 160L115 150L100 140L85 150Z"
              fill="#1A535C"
              opacity="0.8"
            />
          </svg>
        </div>

        {/* Headline */}
        <h2 className="welcome-headline">Your messages are secure</h2>

        {/* Sub-headline */}
        <p className="welcome-subheadline">
          Start a new end-to-end encrypted conversation.
        </p>

        {/* Start Chat Form */}
        <form className="welcome-form" onSubmit={handleSubmit}>
          <label className="welcome-label">Start chat with:</label>
          <input
            type="text"
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="welcome-input"
          />
          <button type="submit" className="welcome-button">
            Start Chat
          </button>
        </form>
      </div>
    </div>
  );
};

export default WelcomeScreen;

