import { useState, useEffect } from 'react'
import { Message } from './types'
import ChatSection from './components/ChatSection'
import { initializeAgent } from './services/api'
import './App.css'

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [tokenAddress, setTokenAddress] = useState<string>('')
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  const handleCopy = async () => {
    if (tokenAddress) {
      await navigator.clipboard.writeText(tokenAddress);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    }
  };

  const checkCurrentTab = () => {
    console.log('Checking current tab...');
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      console.log('Current tab:', tabs[0]);
      if (tabs[0]?.id && !tabs[0].url?.startsWith('chrome://')) {
        try {
          console.log('Sending REQUEST_ADDRESS to tab:', tabs[0].id);
          await chrome.tabs.sendMessage(tabs[0].id, { type: "REQUEST_ADDRESS" });
        } catch (error) {
          console.log('Error sending message, attempting to inject content script:', error);
          // Try to inject the content script
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ['contentScript.js']
            });
            // Try sending the message again after injection
            await chrome.tabs.sendMessage(tabs[0].id, { type: "REQUEST_ADDRESS" });
          } catch (injectionError) {
            console.error('Failed to inject content script:', injectionError);
          }
        }
      }
    });
  };

  useEffect(() => {
    // Initialize agent when app starts
    const init = async () => {
      try {
        const success = await initializeAgent();
        if (success) {
          setMessages([{
            id: Date.now().toString(),
            text: "Hello! I'm your trading assistant. How can I help you today?",
            type: 'bot',
            timestamp: new Date()
          }]);
        } else {
          setMessages([{
            id: Date.now().toString(),
            text: "Sorry, I'm having trouble connecting to the server. Please try again later.",
            type: 'bot',
            timestamp: new Date()
          }]);
        }
      } catch (error) {
        console.error('Failed to initialize agent:', error);
      }
    };

    init();

    // Connect to the background script
    const port = chrome.runtime.connect({ name: "sidepanel" });
    
    // Listen for messages from the background script
    const messageListener = (message: any) => {
      console.log('Received message:', message);
      if (message.type === "ADDRESS_UPDATE") {
        console.log('Setting new address:', message.data.address);
        setTokenAddress(message.data.address);
      }
    };

    // Listen for tab changes
    const tabChangeListener = (_activeInfo: chrome.tabs.TabActiveInfo) => {
      console.log('Tab changed, activeInfo:', _activeInfo);
      checkCurrentTab();
    };

    // Listen for tab updates
    const tabUpdateListener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      console.log('Tab updated:', { tabId, changeInfo, tab });
      if (changeInfo.status === 'complete' && tab.active) {
        checkCurrentTab();
      }
    };

    console.log('Setting up event listeners...');
    chrome.runtime.onMessage.addListener(messageListener);
    chrome.tabs.onActivated.addListener(tabChangeListener);
    chrome.tabs.onUpdated.addListener(tabUpdateListener);

    // Check current tab immediately
    console.log('Initial tab check...');
    checkCurrentTab();

    // Cleanup
    return () => {
      console.log('Cleaning up event listeners...');
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.tabs.onActivated.removeListener(tabChangeListener);
      chrome.tabs.onUpdated.removeListener(tabUpdateListener);
      port.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col min-h-0 bg-[#1a1f2e] text-gray-200 h-full w-full p-0">
      <header className="flex flex-col border-b border-[#2d3548]">
        <div className="flex items-center py-2">
          <h1 className="text-lg font-semibold">Trading Assistant</h1>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <input
            type="text"
            value={tokenAddress || "No address detected"}
            readOnly
            className="w-full bg-[#242b3d] border border-[#2d3548] rounded-lg px-3 py-2 text-sm text-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
          />
          <button 
            onClick={handleCopy}
            className="p-2 bg-[#242b3d] border border-[#2d3548] rounded-lg text-gray-400 hover:text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-colors"
            disabled={!tokenAddress}
          >
            {showCopySuccess ? (
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            )}
          </button>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto overflow-x-hidden flex-grow">
        <ChatSection messages={messages} setMessages={setMessages} />
      </div>
    </div>
  )
}

export default App
