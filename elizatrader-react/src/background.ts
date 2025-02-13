/// <reference types="chrome" />

let currentAddress: string | null = null;

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Trading Assistant extension installed');
  // Set the initial state of the side panel
  chrome.sidePanel.setOptions({
    enabled: true,
    path: 'index.html'
  });
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Toggle the side panel
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type === "ADDRESS_UPDATE") {
    currentAddress = message.data.address;
    // Forward the address update to the side panel
    chrome.runtime.sendMessage({
      type: "ADDRESS_UPDATE",
      data: message.data,
    });
  }
});

// Handle side panel initialization
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidepanel") {
    // Send current address if available
    if (currentAddress) {
      port.postMessage({
        type: "ADDRESS_UPDATE",
        data: { address: currentAddress },
      });
    }
  }
});

export {}; 