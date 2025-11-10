import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Login from "./Login";
import Register from "./Register";

const Home = () => {
  const [showLogin, setShowLogin] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();

  // Check if already logged in
  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        navigate("/chat", { replace: true });
      } else {
        setCheckingAuth(false);
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      setCheckingAuth(false);
    }
  }, [navigate]);

  if (checkingAuth) {
    return (
      <div className="home-page">
        <div className="home-container">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="home-container">
        <div className="home-header">
          <h1>🔒 E2EE Chat</h1>
          <p>End-to-End Encrypted Secure Messaging</p>
        </div>

        <div className="auth-tabs">
          <button
            className={showLogin ? "active" : ""}
            onClick={() => setShowLogin(true)}
          >
            Login
          </button>
          <button
            className={!showLogin ? "active" : ""}
            onClick={() => setShowLogin(false)}
          >
            Register
          </button>
        </div>

        <div className="auth-content">
          {showLogin ? <Login /> : <Register />}
        </div>
      </div>
    </div>
  );
};

export default Home;

