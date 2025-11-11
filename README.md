# Kimi AI to OpenAI API Gateway

A simple proxy that converts Kimi AI's chat service into an OpenAI-compatible API format.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Powered by Deno](https://img.shields.io/badge/Powered%20by-Deno-000000?logo=deno)](https://deno.land)

## What is this?

This project lets you use Kimi AI with any app that supports OpenAI's API format. No need to learn a new API - just point your existing tools at this gateway and start using Kimi AI's powerful long-context capabilities.

**Use cases:**
- Use Kimi AI with ChatGPT clients like NextChat or LobeChat
- Integrate Kimi AI into your existing applications
- Access Kimi's long-context processing through familiar OpenAI SDKs

## Features

- **OpenAI Compatible** - Works with any OpenAI-compatible client
- **Streaming Support** - Real-time response streaming
- **Session Management** - Maintains conversation history per user
- **Simple Setup** - Deploy in minutes with Deno Deploy
- **Secure** - API key authentication built-in





## Quick Start

### Deploy to Deno Deploy (Recommended)

1. **Fork this project to your GitHub account**
   - Visit [https://github.com/Kirazul/kimi-deploy](https://github.com/Kirazul/kimi-deploy)
   - Click the "Fork" button in the top right

2. **Login to Deno Deploy**
   - Visit [https://deno.com/deploy](https://deno.com/deploy)
   - Sign in with your GitHub account

3. **Create a new project**
   - Click "New Project"
   - Select your forked repository `kimi-deploy`
   - Choose `main.ts` as the entry file

4. **Configure environment variables**
   - Add environment variables in project settings:
     - `API_MASTER_KEY`: Your API key (strongly recommended to change!)
     - `PORT`: Leave empty (Deno Deploy handles this automatically)
     - `SESSION_CACHE_TTL`: `3600` (optional)

5. **Deployment complete!**
   - Deno Deploy will automatically deploy and provide an HTTPS URL
   - Use the provided URL + `/v1` as your API endpoint

**Your API is now live!**
- API URL: `https://your-project.deno.dev/v1`
- API Key: Your configured `API_MASTER_KEY`
- Models: `kimi-k2-instruct-0905` or `kimi-k2-instruct`

### Run Locally

#### Step 1: Install Deno

**macOS / Linux:**
```bash
curl -fsSL https://deno.land/x/install/install.sh | sh
```

**Windows (PowerShell):**
```powershell
irm https://deno.land/x/install/install.ps1 | iex
```

#### Step 2: Clone the project
```bash
git clone https://github.com/Kirazul/kimi-deploy.git
cd kimi-deploy
```

#### Step 3: Configure environment
Copy `.env.example` to `.env` and modify the configuration:
```env
# Security configuration - strongly recommended to change!
API_MASTER_KEY=sk-your-secret-key-123456

# Service configuration
PORT=8088

# Session management
SESSION_CACHE_TTL=3600
```

#### Step 4: Start the service
```bash
deno task start
# Or use development mode (auto-reload)
deno task dev
```

Success output:
```
kimi-ai-2api-deno v1.0.0 starting...
Initializing KimiAIProvider, fetching nonce for the first time...
Successfully fetched new nonce: xxxxxxxxx
Service started, listening on http://localhost:8088
```

#### Step 5: Test it
Your API is now running at `http://localhost:8088`

Configure your OpenAI client:
- API URL: `http://localhost:8088/v1`
- API Key: Your `API_MASTER_KEY` from `.env`
- Models: `kimi-k2-instruct-0905` or `kimi-k2-instruct`

## How It Works

1. Your app sends a request in OpenAI format
2. Gateway converts it to Kimi AI format
3. Sends request to Kimi AI
4. Receives response from Kimi AI
5. Converts response back to OpenAI format
6. Streams it back to your app

Simple as that!

---

## 📁 Project Structure

```
kimi-deploy/
├── 📄 main.ts                 # Core entry file
├── 📄 .env                    # Environment configuration
├── 📄 .env.example            # Environment template
├── 📄 deno.json               # Deno configuration
├── � RyEADME.md               # Project documentation
├── 📄 LICENSE                 # Apache 2.0 License
└── 📄 .gitignore              # Git ignore rules
```

## Configuration

Set these environment variables in Deno Deploy or your `.env` file:

- `API_MASTER_KEY` - Your API key for authentication (set to "1" to disable auth)
- `PORT` - Port to run on (default: 8088, not needed for Deno Deploy)
- `SESSION_CACHE_TTL` - How long to keep conversation history in seconds (default: 3600)

---

## 📜 License

This project is licensed under the **Apache 2.0 License** - you are free to use, modify, and distribute it under the terms of the license.

[View full license](https://opensource.org/licenses/Apache-2.0)

---

If this helps you, give it a ⭐ star!
```
