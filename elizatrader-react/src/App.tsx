import { useState, useEffect } from 'react'
import { Message } from './types'
import ChatSection from './components/ChatSection'
import { initializeAgent, initializeSocket, sendMessage } from './services/api'
import './App.css'

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [tokenAddress, setTokenAddress] = useState<string>('')
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const handleCopy = async () => {
    if (tokenAddress) {
      await navigator.clipboard.writeText(tokenAddress);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    }
  };

  // Trigger scan whenever tokenAddress changes
  useEffect(() => {
    if (tokenAddress && !isScanning) {
      console.log('New address detected, starting scan:', tokenAddress);
      setIsScanning(true);
      
      const scanCommand = `Scan: ${tokenAddress}`;
      sendMessage(scanCommand)
        .then(response => {
          setMessages(prev => {
            // Remove any update messages and add the final response
            const messagesWithoutUpdates = prev.filter(m => m.type !== 'update');
            return [...messagesWithoutUpdates, {
              id: Date.now().toString(),
              text: scanCommand,
              type: 'user',
              timestamp: new Date()
            }, response];
          });
        })
        .catch(error => {
          console.error('Failed to send scan command:', error);
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            text: 'Sorry, I encountered an error while scanning. Please try again.',
            type: 'bot',
            timestamp: new Date()
          }]);
        })
        .finally(() => {
          setIsScanning(false);
        });
    }
  }, [tokenAddress]);

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
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ['contentScript.js']
            });
            await chrome.tabs.sendMessage(tabs[0].id, { type: "REQUEST_ADDRESS" });
          } catch (injectionError) {
            console.error('Failed to inject content script:', injectionError);
          }
        }
      }
    });
  };

  useEffect(() => {
    // Initialize socket connection with streaming update handler
    const socket = initializeSocket((data) => {
      console.log("DEBUG - Handling streaming update in App:", data);
      if (data.text) {
        setMessages(prev => {
          // Always append messages, regardless of type
          return [...prev, {
            id: Date.now().toString(),
            text: data.text,
            type: data.type || 'update',
            timestamp: new Date()
          }];
        });
      }
    });

    // Initialize agent
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
          
          console.log('Checking for current address...');
          checkCurrentTab();
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

    const port = chrome.runtime.connect({ name: "sidepanel" });
    
    const messageListener = (message: any) => {
      console.log('Received message:', message);
      if (message.type === "ADDRESS_UPDATE") {
        const newAddress = message.data.address;
        console.log('Setting new address:', newAddress);
        // Only update if the address is different to prevent unnecessary rescans
        if (newAddress !== tokenAddress) {
          setTokenAddress(newAddress);
        }
      }
    };

    const tabChangeListener = (_activeInfo: chrome.tabs.TabActiveInfo) => {
      console.log('Tab changed, activeInfo:', _activeInfo);
      checkCurrentTab();
    };

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

    return () => {
      console.log('Cleaning up event listeners...');
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.tabs.onActivated.removeListener(tabChangeListener);
      chrome.tabs.onUpdated.removeListener(tabUpdateListener);
      port.disconnect();
      // Cleanup socket on unmount
      if (socket) {
        socket.disconnect();
      }
    };
  }, []); // Empty dependency array means this runs once on mount

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
        <ChatSection 
          messages={messages} 
          setMessages={setMessages} 
          isScanning={isScanning}
        />
      </div>
    </div>
  )
}

export default App
