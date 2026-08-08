// Extracts a reasonably clean text version of the current page.
// Runs only when asked (via message), not automatically, to keep things lightweight.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_PAGE_TEXT") {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll("script, style, noscript, svg, nav, footer").forEach((el) => el.remove());
    const text = clone.innerText.replace(/\s+/g, " ").trim();
    sendResponse({ text, title: document.title, url: location.href });
  }
  return true;
});
