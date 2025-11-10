import axios from "axios";

// In development, use relative URL so Vite proxy can forward requests
// In production or when VITE_API_URL is set, use that URL directly
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const API = axios.create({
  baseURL: API_BASE_URL,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  try {
    // Replay protection headers
    const id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    config.headers["X-Request-Id"] = id;
    config.headers["X-Timestamp"] = Date.now().toString();
  } catch (_) {
    // ignore if crypto not available
    config.headers["X-Request-Id"] = `${Date.now()}-${Math.random()}`;
    config.headers["X-Timestamp"] = Date.now().toString();
  }
  return config;
});

export default API;

// API functions
export const registerUser = (data) => API.post("/auth/register", data);
export const loginUser = (data) => API.post("/auth/login", data);

// Key management
export const uploadDeviceKeys = (data) => API.post("/keys/device/keys", data);
export const getUserKeyBundle = (userId) => API.get(`/keys/user/${userId}/bundle`);
export const getMyDevices = () => API.get("/keys/devices");
export const revokeDevice = (deviceId) => API.post(`/keys/device/${deviceId}/revoke`);

// Messages (encrypted)
export const sendEncryptedMessage = (data) => API.post("/messages/send", data);
export const getEncryptedMessages = (recipientId, deviceId) => 
  API.get("/messages", { 
    params: { 
      ...(recipientId ? { recipientId } : {}),
      ...(deviceId ? { deviceId } : {}),
    } 
  });
export const getQueuedMessages = (deviceId) => 
  API.get("/messages/queued", { params: { deviceId } });
export const markMessageAsRead = (messageId, deviceId) => 
  API.post(`/messages/${messageId}/read`, null, { params: { deviceId } });

// User relationship and conversation management
export const blockUser = (user) => API.post("/user/block", { user });
export const unblockUser = (user) => API.post("/user/unblock", { user });
export const deleteConversation = (other) => API.delete(`/user/conversations/${other}`);