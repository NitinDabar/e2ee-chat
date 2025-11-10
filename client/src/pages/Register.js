import { useState } from "react";
import API from "../api/api";
import { useNavigate } from "react-router-dom";

const Register = () => {
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const { data } = await API.post("/auth/register", form);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/chat", { replace: true });
    } catch (err) {
      let errorMessage = "Registration failed. Try again.";
      
      // Handle network errors
      if (err.code === "ECONNREFUSED" || err.code === "ERR_NETWORK" || !err.response) {
        errorMessage = "Cannot connect to server. Please make sure the server is running on port 5000.";
      } else if (err.response?.data) {
        // Handle validation errors with details
        if (err.response.data.details && Array.isArray(err.response.data.details)) {
          errorMessage = err.response.data.details
            .map((detail) => detail.message)
            .join(", ");
        } else if (err.response.data.error) {
          errorMessage = err.response.data.error;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      console.error("Registration error:", err);
    }
  };

  return (
    <div className="auth-form">
      <h2>Register</h2>
      <form onSubmit={handleSubmit}>
        <input 
          name="username" 
          type="text"
          value={form.username}
          placeholder="Username" 
          onChange={handleChange} 
          required
        />
        <input 
          name="email" 
          type="email" 
          value={form.email}
          placeholder="Email" 
          onChange={handleChange} 
          required
        />
        <input 
          name="password" 
          type="password" 
          value={form.password}
          placeholder="Password (min 8 characters)" 
          onChange={handleChange} 
          required
          minLength={8}
        />
        <button type="submit">Register</button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
};

export default Register;
