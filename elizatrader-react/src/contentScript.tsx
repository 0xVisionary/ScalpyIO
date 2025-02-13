console.log('Trading Assistant content script loaded');

// Function to find Solana address in text
const findSolanaAddress = (text: string): string | null => {
  const match = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  return match ? match[0] : null;
};

// Function to get token address from Photon UI
const getPhotonTokenAddress = (): string | null => {
  // Look for Solscan token links
  const tokenLinks = document.querySelectorAll('a[href*="solscan.io/account"]');
  for (const link of tokenLinks) {
    // Check if the link text contains "Token"
    if (link.textContent?.includes('Token')) {
      const href = link.getAttribute('href');
      if (href) {
        const address = findSolanaAddress(href);
        if (address) {
          console.log('Found token address in Solscan link:', address);
          return address;
        }
      }
    }
  }
  return null;
};

// Function to check if we're on Photon
const isPhotonSite = () => {
  return window.location.hostname.includes('photon-sol.tinyastro.io');
};

// Main function to find address
const findAddress = (): string | null => {
  if (isPhotonSite()) {
    console.log('On Photon site, looking for token address in UI...');
    return getPhotonTokenAddress();
  }

  // Fallback to URL check for other sites
  const address = findSolanaAddress(window.location.href);
  return address;
};

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "REQUEST_ADDRESS") {
    console.log('Received address request');
    const address = findAddress();
    console.log('Found address:', address);
    if (address) {
      chrome.runtime.sendMessage({
        type: "ADDRESS_UPDATE",
        data: { address }
      });
    }
  }
});

// Initial check
const address = findAddress();
if (address) {
  chrome.runtime.sendMessage({
    type: "ADDRESS_UPDATE",
    data: { address }
  });
}

// Watch for DOM changes on Photon site
if (isPhotonSite()) {
  const observer = new MutationObserver(() => {
    const address = findAddress();
    if (address) {
      chrome.runtime.sendMessage({
        type: "ADDRESS_UPDATE",
        data: { address }
      });
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

export {}; 