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

// Keep track of current address
let currentAddress: string | null = null;

// Main function to find and send address
const findAndSendAddress = (): void => {
  if (isPhotonSite()) {
    console.log('On Photon site, looking for token address in UI...');
    const address = getPhotonTokenAddress();
    
    // Send if address is found and it's different from current
    if (address && address !== currentAddress) {
      console.log('Found new address, sending:', address);
      chrome.runtime.sendMessage({
        type: "ADDRESS_UPDATE",
        data: { address }
      });
      currentAddress = address;
    } else if (address && currentAddress === address) {
      // If we have an address and it's requested again, resend it
      console.log('Resending current address:', address);
      chrome.runtime.sendMessage({
        type: "ADDRESS_UPDATE",
        data: { address }
      });
    }
  }
};

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "REQUEST_ADDRESS") {
    console.log('Received address request');
    findAndSendAddress();
  }
});

// Watch for DOM changes on Photon site
if (isPhotonSite()) {
  let debounceTimeout: NodeJS.Timeout | null = null;
  
  const observer = new MutationObserver(() => {
    // Clear existing timeout
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    
    // Set new timeout
    debounceTimeout = setTimeout(() => {
      findAndSendAddress();
    }, 1000); // Wait 1 second after changes stop before checking
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

export {}; 