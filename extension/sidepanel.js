// ==== CONFIG ====
// Replace with your deployed backend URL once live on Render.
const BACKEND_URL = "http://localhost:4000"; // e.g. "https://browsermate-backend.onrender.com"
const CLIENT_ID_KEY = "bm_client_id";

const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const typingIndicator = document.getElementById("typingIndicator");
const clearBtn = document.getElementById("clearBtn");

let messages = []; // { role: "user"|"assistant", content: string }

init();

async function init() {
  await ensureClientId();
  renderEmptyState();
  wireEvents();
  checkPendingQuickAction();
}

function wireEvents() {
  chatForm.addEventListener("submit", onSend);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });
  clearBtn.addEventListener("click", () => {
    messages = [];
    chatLog.innerHTML = "";
    renderEmptyState();
  });

  document.querySelectorAll(".qa-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleQuickActionButton(btn.dataset.action));
  });
}

function renderEmptyState() {
  if (messages.length === 0) {
    chatLog.innerHTML = `<div class="empty-state">Ask me anything, or use a quick action above to work with the current page.</div>`;
  }
}

async function ensureClientId() {
  const stored = await chrome.storage.local.get(CLIENT_ID_KEY);
  if (!stored[CLIENT_ID_KEY]) {
    const id = "bm-" + Math.random().toString(36).slice(2) + Date.now();
    await chrome.storage.local.set({ [CLIENT_ID_KEY]: id });
  }
}

async function getClientId() {
  const stored = await chrome.storage.local.get(CLIENT_ID_KEY);
  return stored[CLIENT_ID_KEY];
}

function addMessage(role, content) {
  document.querySelector(".empty-state")?.remove();
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = content;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

async function onSend(e) {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = "";
  addMessage("user", text);
  messages.push({ role: "user", content: text });

  await sendChat();
}

async function sendChat() {
  setLoading(true);
  try {
    const pageContext = await getCurrentPageText();
    const clientId = await getClientId();

    const res = await fetch(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": clientId,
      },
      body: JSON.stringify({ messages, pageContext }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong");

    addMessage("assistant", data.reply);
    messages.push({ role: "assistant", content: data.reply });
  } catch (err) {
    addMessage("error", `Error: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

function setLoading(loading) {
  sendBtn.disabled = loading;
  typingIndicator.classList.toggle("hidden", !loading);
}

async function getCurrentPageText() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return "";
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_TEXT" });
    return response?.text || "";
  } catch {
    return ""; // content script may not be injected on chrome:// pages etc.
  }
}

async function handleQuickActionButton(action) {
  if (action === "summarize") {
    const pageText = await getCurrentPageText();
    if (!pageText) {
      addMessage("error", "Couldn't read this page (try a regular website tab).");
      return;
    }
    await runQuickAction("summarize", pageText);
  } else if (action === "explain-selection") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: selection }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString(),
    });
    if (!selection) {
      addMessage("error", "Select some text on the page first.");
      return;
    }
    await runQuickAction("explain", selection);
  }
}

async function runQuickAction(action, text) {
  addMessage("user", `[${action}] ${text.slice(0, 120)}${text.length > 120 ? "…" : ""}`);
  setLoading(true);
  try {
    const clientId = await getClientId();
    const res = await fetch(`${BACKEND_URL}/api/quick-action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": clientId,
      },
      body: JSON.stringify({ action, text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    addMessage("assistant", data.reply);
    messages.push({ role: "assistant", content: data.reply });
  } catch (err) {
    addMessage("error", `Error: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

async function checkPendingQuickAction() {
  const stored = await chrome.storage.local.get("pendingQuickAction");
  const pending = stored.pendingQuickAction;
  if (pending?.text) {
    await chrome.storage.local.remove("pendingQuickAction");
    await runQuickAction(pending.action, pending.text);
  }
}
