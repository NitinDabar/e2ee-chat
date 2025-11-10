/**
 * Generate a unique device ID
 */
export const generateDeviceId = () => {
  // Use browser fingerprint + timestamp + random
  const fingerprint = navigator.userAgent + navigator.language + screen.width + screen.height;
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  
  // Simple hash
  let hash = 0;
  const str = fingerprint + timestamp + random;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `device_${Math.abs(hash)}_${timestamp}`;
};

/**
 * Get or create device ID
 */
export const getOrCreateDeviceId = () => {
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem("deviceId", deviceId);
  }
  return deviceId;
};

