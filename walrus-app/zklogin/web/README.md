# zkLogin Demo Application

A Sui blockchain zkLogin demo implementation with Google OAuth integration.

## 📋 Prerequisites

- **Node.js** (v18 or later)
- **pnpm** package manager
- **Google OAuth credentials** (Client ID and Client Secret)

### Install pnpm (if not already installed)
```bash
npm install -g pnpm
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd /path/to/your/zklogin/web
pnpm install
```

### 2. Configure Google OAuth
The application requires Google OAuth credentials. Make sure the `src/config.json` file contains:

```json
{
  "CLIENT_ID_GOOGLE": "your-google-client-id",
  "GOOGLE_CLIENT_ID": "your-google-client-id",
  "GOOGLE_CLIENT_SECRET": "your-google-client-secret",
  "GOOGLE_REDIRECT_URI": "http://localhost:3000/auth/google/callback",
  "BACKEND_URL": "http://localhost:3000",
  "URL_SALT_SERVICE": "/dummy-salt-service.json",
  "URL_ZK_PROVER": "https://prover-dev.mystenlabs.com/v1"
}
```

### 3. Run the Application

#### Option A: Run Both Services Together (Recommended but may have port conflicts)
```bash
pnpm start
```

#### Option B: Run Services Separately (Recommended)

**Terminal 1 - Backend Server (port 3000):**
```bash
PORT=3000 npx tsx server/src/server.ts
```

**Terminal 2 - Frontend App (port 5173):**
```bash
pnpm dev --port 5173
```

## 🌐 Access Points

- **Frontend Application**: http://localhost:5173/
- **Backend API**: http://localhost:3000/
- **Google OAuth Callback**: http://localhost:3000/auth/google/callback

## 📁 Project Structure

```
web/
├── src/                    # Frontend React application
│   ├── App.tsx            # Main React component
│   ├── config.json        # Configuration file (Google OAuth, etc.)
│   └── ...
├── server/                 # Backend Express server
│   └── src/
│       ├── server.ts      # Main server file
│       └── googleAuth.ts  # Google OAuth routes
├── public/                 # Static assets
└── package.json           # Dependencies and scripts
```

## 🛠️ Available Scripts

- `pnpm dev` - Start frontend development server
- `pnpm server` - Start backend server with hot reload
- `pnpm start` - Run both frontend and backend concurrently
- `pnpm build` - Build production version
- `pnpm preview` - Preview production build

## 🔧 Configuration Details

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add `http://localhost:3000/auth/google/callback` to authorized redirect URIs
6. Copy Client ID and Client Secret to `src/config.json`

### Port Configuration
- **Backend Server**: Port 3000 (required for Google OAuth callback)
- **Frontend App**: Port 5173 (to avoid conflicts with backend)

## 🔍 API Endpoints

### Backend Server (localhost:3000)
- `GET /` - API information and status
- `GET /auth/google/url` - Get Google OAuth URL for frontend
- `GET /auth/google` - Direct Google OAuth redirect
- `GET /auth/google/callback` - OAuth callback endpoint (used by Google)

## 🚨 Troubleshooting

### Port Already in Use
If you get "EADDRINUSE" errors:
```bash
# Kill processes using the ports
pkill -f "vite|tsx|node"

# Or check what's using port 3000
lsof -i :3000
```

### Server Exits Immediately
- Check if `src/config.json` exists and has valid Google OAuth credentials
- Ensure all required dependencies are installed: `pnpm install`

### Frontend Can't Connect to Backend
- Verify backend is running on port 3000
- Check that `BACKEND_URL` in `config.json` matches the backend port

## 🧪 Development

### Environment Variables
You can override the default port for the backend:
```bash
PORT=8000 npx tsx server/src/server.ts
```

### Hot Reload
Both frontend and backend support hot reload:
- Frontend: Automatic with Vite
- Backend: Using `tsx --watch`

## 📦 Production Build

```bash
# Build the frontend
pnpm build

# Preview the production build
pnpm preview
```

## 🔐 Security Notes

- Never commit `config.json` with real credentials to version control
- Use environment variables for production deployments
- Ensure Google OAuth redirect URIs match your deployment URLs

## 📚 Additional Resources

- [Sui zkLogin Documentation](https://docs.sui.io/concepts/cryptography/zklogin)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Vite Documentation](https://vitejs.dev/)

---

## 🆘 Need Help?

If you encounter issues:
1. Ensure all prerequisites are installed
2. Check that ports 3000 and 5173 are available
3. Verify Google OAuth configuration
4. Check browser console for frontend errors
5. Check terminal output for backend errors