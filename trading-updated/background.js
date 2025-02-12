chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Handle connections between content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.tab) {
    chrome.runtime.sendMessage(message);
  }
}); 