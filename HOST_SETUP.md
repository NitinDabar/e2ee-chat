# Setting up E2EE-chat Domain

The application can run using `localhost` by default or a custom host (`E2EE-chat`) if you prefer. Using `localhost` is recommended for development to avoid DNS/hosts setup.

## Quick Setup (Windows)

1. **Open hosts file as Administrator:**
   - Press `Win + R`
   - Type: `notepad C:\Windows\System32\drivers\etc\hosts`
   - Press `Ctrl + Shift + Enter` to run as admin

2. **Add this line at the end:**
   ```
   127.0.0.1    E2EE-chat
   ```

3. **Save the file**

4. **Flush DNS cache:**
   - Open Command Prompt as Admin
   - Run: `ipconfig /flushdns`

5. **Restart your browser**

## Access URLs:

- **Client:** http://E2EE-chat:3000
- **Server API:** http://E2EE-chat:5000

## If you prefer to use localhost:

Edit `client/src/api/api.js` and change:
```javascript
const API_HOST = import.meta.env.VITE_API_HOST || "localhost";
```

And update `client/vite.config.js`:
```javascript
host: process.env.VITE_HOST || "localhost",
target: process.env.VITE_API_URL || "http://localhost:5000",
```

