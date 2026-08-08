# BrowserMate — AI Assistant for Chrome

A Claude/ChatGPT-style AI assistant that lives in your browser's side panel. Chat with it directly,
or use quick actions to summarize the current page, explain selected text, or rewrite text — all
without leaving your tab.

## Architecture

```
Chrome Extension (Manifest V3)          Backend (Node.js / Express)         LLM
┌─────────────────────────┐             ┌──────────────────────┐          ┌──────────┐
│ Side Panel UI (chat)     │  fetch()    │ /api/chat             │  API     │ Anthropic│
│ Content script (page     │ ──────────▶ │ /api/quick-action      │ ───────▶ │ Claude    │
│  text extraction)        │             │ Per-client rate limit  │          │           │
│ Context menu actions     │             └──────────────────────┘          └──────────┘
└─────────────────────────┘
```

The API key never touches the browser — the extension only talks to your own backend, which
holds the key and proxies requests to the LLM provider.

## Features

- **Chat sidebar** — ask anything, with the current page's text available as context
- **Summarize page** — one click to get a summary of the active tab
- **Explain selection** — right-click any selected text → "BrowserMate: Explain this"
- **Rewrite selection** — right-click → "BrowserMate: Rewrite this"
- **Per-client rate limiting** on the backend to prevent abuse

## Tech Stack

| Component | Tool |
|---|---|
| Extension | Manifest V3, vanilla JS, Chrome Side Panel API |
| Backend | Node.js, Express |
| LLM | Anthropic Claude API |
| Deployment | Render (backend), Chrome (unpacked / Web Store) |

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
npm install
npm run dev   # runs on http://localhost:4000
```

### 2. Extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder
4. Pin the extension, click its icon to open the side panel

By default the extension points at `http://localhost:4000`. Once the backend is deployed, update
`BACKEND_URL` in `extension/sidepanel.js` to your live URL and reload the extension.

## What I'd improve to scale this

- Move rate limiting to Redis so it survives backend restarts and works across multiple instances
- Add streaming responses (SSE) instead of waiting for the full reply
- Add a proper auth layer (per-user API keys) instead of anonymous client IDs
- Cache page-text extraction per tab to avoid re-scraping on every message
