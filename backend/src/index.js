require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Simple in-memory rate limiting per extension install (very lightweight, not for production scale)
const requestCounts = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

function rateLimit(req, res, next) {
  const id = req.headers["x-client-id"] || req.ip;
  const now = Date.now();
  const entry = requestCounts.get(id) || { count: 0, windowStart: now };

  if (now - entry.windowStart > WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }

  entry.count += 1;
  requestCounts.set(id, entry);

  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: "Rate limit exceeded. Please wait a moment." });
  }
  next();
}

app.get("/api/health", (req, res) => {
  res.json({ message: "BrowserMate backend is running" });
});

// Main chat endpoint
// body: { messages: [{role, content}], pageContext?: string }
app.post("/api/chat", rateLimit, async (req, res) => {
  try {
    const { messages, pageContext } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const systemPrompt = pageContext
      ? `You are BrowserMate, a helpful AI assistant embedded in the user's browser. The user is currently viewing a webpage. Here is the visible page content for context (use it only if relevant to the user's question):\n\n${pageContext.slice(0, 6000)}\n\n`
      : "You are BrowserMate, a helpful AI assistant embedded in the user's browser.\n\n";

    const conversationText =
      systemPrompt +
      messages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");

    const result = await model.generateContent(conversationText);
    const reply = result.response.text();
    res.json({ reply });
  } catch (err) {
    console.error("[Chat] error:", err.message);
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

// Quick-action endpoint for selected text (Explain / Summarize / Rewrite / Translate)
// body: { action: "explain"|"summarize"|"rewrite"|"translate", text: string, targetLanguage?: string }
app.post("/api/quick-action", rateLimit, async (req, res) => {
  try {
    const { action, text, targetLanguage } = req.body;
    if (!text || !action) {
      return res.status(400).json({ error: "action and text are required" });
    }

    const prompts = {
      explain: `Explain the following text simply and clearly:\n\n${text}`,
      summarize: `Summarize the following text in a few concise bullet points:\n\n${text}`,
      rewrite: `Rewrite the following text to be clearer and more polished, keeping the same meaning:\n\n${text}`,
      translate: `Translate the following text to ${targetLanguage || "English"}:\n\n${text}`,
    };

    const prompt = prompts[action];
    if (!prompt) {
      return res.status(400).json({ error: "Unknown action" });
    }

    const result = await model.generateContent(prompt);
    const reply = result.response.text();
    res.json({ reply });
  } catch (err) {
    console.error("[QuickAction] error:", err.message);
    res.status(500).json({ error: "Failed to process quick action" });
  }
});

app.listen(PORT, () => {
  console.log(`BrowserMate backend listening on port ${PORT}`);
});
