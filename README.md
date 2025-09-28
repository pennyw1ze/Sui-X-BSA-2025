# Sui-X-BSA-2025

## Members:

- **Sparsh**, Technical University of Munich;
- **Rami**, Technical University of Munich;
- **Leo**, Sapienza Università di Roma;
- **Ricky**, Sapienza Università di Roma;
- **Eva**, Tor Vergata University;

## Overview

Walrus Vault is a decentralized platform for anonymous document sharing and whistleblowing built on the Sui blockchain. It combines:
- **Walrus storage** for decentralized file storage
- **zkLogin** for privacy-preserving authentication
- **Sui blockchain** for document metadata and governance
- **AI-powered insights** for leak categorization and analysis

## Architecture

The application consists of two main components:

### Frontend (`walrus-app/frontend/`)
- **React + Vite** application with TypeScript support
- **@mysten/dapp-kit** for Sui wallet integration
- **zkLogin** implementation for anonymous authentication
- **Walrus SDK** for decentralized file upload/download
- Real-time leak carousel with AI-generated insights

### Backend (`walrus-app/backend/`)
- **Express.js** API server with structured logging
- **Google OAuth** integration for zkLogin authentication
- **OpenRouter AI** integration for leak analysis and tagging
- **Sui blockchain** integration for on-chain document metadata
- Python agents for advanced document analysis

## Prerequisites

- **Node.js** (v18 or higher)
- **Python** (3.8 or higher)
- **Sui wallet** (for blockchain interactions)
- **Google OAuth credentials** (for zkLogin)
- **OpenRouter API key** (for AI features)

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/SparshTyagi/Sui-X-BSA-2025.git
cd Sui-X-BSA-2025
```

### 2. Backend Setup

```bash
cd walrus-app/backend

# Install Node.js dependencies
npm install

# Install Python dependencies for AI agents

# Install Node.js dependencies
npm install

# Install Python dependencies for AI agents
python -m pip install -r requirements.txt

# Create environment configuration
cp .env.example .env
```

**Configure environment variables** in `walrus-app/backend/.env`:

```env
# Google OAuth (required for zkLogin)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# Server Configuration
PORT=3000
ZKLOGIN_FRONTEND_URL=http://localhost:3000
FRONTEND_BASE_URL=http://localhost:3000

# OpenRouter AI (required for leak insights)
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=x-ai/grok-4-fast:free
OPENROUTER_SITE_URL=https://your-site.com
OPENROUTER_SITE_NAME=Walrus Vault

# Sui Blockchain Configuration
SUI_DOCUMENT_LIST_ID=0xd7515be8943d0751fc7c11600b9cad477d97f061b081db614379e639f0f02e93
SUI_FULLNODE_URL=https://fullnode.testnet.sui.io/
SUI_DOCUMENT_CACHE_TTL_MS=30000

# Logging
LOG_LEVEL=info
PYTHON_BIN=python
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

```

**Configure environment variables** in `walrus-app/frontend/.env` (optional):

```env
VITE_BACKEND_URL=http://localhost:3000
```

## Usage

### Development Mode

**1. Start the Backend Server:**

```bash
cd walrus-app/backend
npm run dev
# Server runs on http://localhost:3000
```

**2. Start the Frontend Development Server:**

```bash
cd walrus-app/frontend  
npm run build && npm run preview
# Frontend runs on http://localhost:5173
```

**3. Open your browser and navigate to** `http://localhost:5173`

### Production Build

**1. Build the Frontend:**

```bash
cd walrus-app/frontend
npm run build
```

**2. Preview the Production Build:**

```bash
npm run preview
# Preview runs on http://localhost:4173
```

**3. Start the Backend in Production:**

```bash
cd walrus-app/backend
npm start
```

## Features

### 🔐 Anonymous Authentication
- **zkLogin** integration with Google OAuth
- Privacy-preserving authentication without exposing identity
- Ephemeral key management for secure transactions

### 📄 Document Management  
- **Drag & drop** file upload interface
- **Walrus storage** integration for decentralized storage
- Support for multiple file formats (PDF, DOC, images, text)
- **File size limit**: 10MB per file

### 🔗 Blockchain Integration
- **Sui blockchain** for immutable document metadata
- Smart contract integration for document registry
- **Transaction signing** with connected wallets
- On-chain governance and verification

### 🤖 AI-Powered Insights
- **Automated leak analysis** using OpenRouter AI
- **Tag generation** and categorization
- **Insight extraction** for leaked documents
- **Plausibility scoring** and coherence analysis

### 🌐 Real-time Feed
- **Live leak carousel** with community submissions
- **Search functionality** across document titles
- **Responsive design** with smooth animations
- **Fallback content** when live data is unavailable

## API Endpoints

### Backend API (`http://localhost:3000`)

- `GET /` - Health check endpoint
- `GET /leaks` - Retrieve community leak feed with AI insights
- `GET /auth/google/config` - OAuth configuration status
- `GET /auth/google` - Initiate Google OAuth flow
- `GET /auth/google/callback` - OAuth callback handler
- `POST /upload` - Document upload endpoint (if implemented)

## Technology Stack

### Frontend
- **React 18** with Hooks and Context API
- **Vite** for fast development and building
- **@mysten/dapp-kit** for Sui wallet integration
- **@mysten/sui** for blockchain interactions
- **@mysten/walrus** for decentralized storage
- **CSS3** with custom animations and responsive design

### Backend  
- **Express.js** with CORS and middleware support
- **Google Auth Library** for OAuth integration
- **Pino** for structured JSON logging
- **Multer** for multipart form handling
- **Python** agents for AI processing
- **OpenRouter** API for language model access

### Blockchain & Storage
- **Sui blockchain** (Testnet) for smart contracts
- **Walrus** distributed storage network
- **zkLogin** for privacy-preserving authentication

## Smart Contract Integration

The application interacts with deployed Sui smart contracts:

- **Package ID**: `0x15554aa6dea72b642981dd296e4325fc78f8b3cdb02f283837719c37320634d7`
- **Documents List**: `0xd7515be8943d0751fc7c11600b9cad477d97f061b081db614379e639f0f02e93`
- **Network**: Sui Testnet

## Development

### File Structure

```
walrus-app/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── utils/          # Utility functions and helpers
│   │   ├── assets/         # Images and static assets
│   │   └── App.jsx         # Main application component
│   ├── public/             # Static public assets
│   └── package.json        # Frontend dependencies
│
├── backend/                 # Express.js backend server
│   ├── agents/             # Python AI processing agents
│   ├── data/               # Data storage and cache
│   ├── googleAuth.js       # Google OAuth implementation  
│   ├── logger.js           # Structured logging setup
│   ├── index.js            # Main server entry point
│   └── package.json        # Backend dependencies
│
└── smart-contracts/        # Sui Move smart contracts
    └── documents_list/     # Document registry contract
```

### Logging

The backend uses **Pino** for structured logging:

```bash
# Debug mode
LOG_LEVEL=debug npm run dev

# Production JSON logs  
NODE_ENV=production npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project was built for the **BSA × Sui Hackathon 2025**.

## Support

For issues and questions, please open an issue on GitHub or contact the team members.