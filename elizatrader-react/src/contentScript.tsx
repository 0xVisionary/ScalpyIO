console.log('Trading Assistant content script loaded');

// Function to find token address in text content
function findTokenAddress(text: string): string | null {
  const match = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  return match ? match[0] : null;
}

// Function to scan page for token address
function scanPageForAddress() {
  // Check URL first
  const urlAddress = findTokenAddress(window.location.href);
  if (urlAddress) {
    chrome.runtime.sendMessage({
      type: "ADDRESS_UPDATE",
      data: {
        address: urlAddress,
        context: document.title || "Found in URL",
      },
    });
    return;
  }

  // Then check page content
  const pageText = document.body.innerText;
  const pageAddress = findTokenAddress(pageText);
  if (pageAddress) {
    chrome.runtime.sendMessage({
      type: "ADDRESS_UPDATE",
      data: {
        address: pageAddress,
        context: document.title || "Found in page content",
      },
    });
  }
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "REQUEST_ADDRESS") {
    scanPageForAddress();
  }
});

// Initial scan
scanPageForAddress();

// Observe DOM changes
const observer = new MutationObserver(() => {
  scanPageForAddress();
});

// Start observing the document
observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
});

export {}; 