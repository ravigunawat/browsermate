// Open the side panel when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Allow the side panel to open on any site
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Context menu for quick actions on selected text
chrome.runtime.onInstalled.addListener(() => {
  const actions = [
    { id: "bm-explain", title: "BrowserMate: Explain this" },
    { id: "bm-summarize", title: "BrowserMate: Summarize this" },
    { id: "bm-rewrite", title: "BrowserMate: Rewrite this" },
  ];
  actions.forEach((a) =>
    chrome.contextMenus.create({
      id: a.id,
      title: a.title,
      contexts: ["selection"],
    })
  );
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const actionMap = {
    "bm-explain": "explain",
    "bm-summarize": "summarize",
    "bm-rewrite": "rewrite",
  };
  const action = actionMap[info.menuItemId];
  if (!action) return;

  // Store the pending quick action so the side panel can pick it up
  chrome.storage.local.set({
    pendingQuickAction: { action, text: info.selectionText },
  });
  chrome.sidePanel.open({ tabId: tab.id });
});
