import { TokenMetrics, Message } from '../types';
import { io, Socket } from 'socket.io-client';

const BIRDEYE_API_KEY = import.meta.env.VITE_BIRDEYE_API_KEY;
const SERVER_URL = import.meta.env.VITE_SERVER_URL;

let socket: Socket | null = null;
let streamingCallback: ((data: any) => void) | null = null;

// Get extension ID from Chrome runtime
const getExtensionId = () => {
  const extensionId = chrome.runtime.id;
  console.log("DEBUG - Client extensionId:", extensionId);
  return extensionId;
};

export const initializeSocket = (onStreamingUpdate?: (data: any) => void) => {
  console.log("DEBUG - Initializing socket connection");
  if (socket) {
    console.log("DEBUG - Existing socket found, disconnecting");
    socket.disconnect();
  }

  streamingCallback = onStreamingUpdate || null;
  const extensionId = getExtensionId();

  console.log("DEBUG - Creating new socket connection to:", SERVER_URL);
  socket = io(SERVER_URL, {
    query: {
      extensionId
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    withCredentials: true,
    extraHeaders: {
      "Origin": chrome.runtime.getURL("")
    }
  });

  socket.on('connect', () => {
    console.log('DEBUG - Socket connected with ID:', socket?.id);
    console.log('DEBUG - Socket query params:', socket?.io?.opts?.query);
  });

  socket.on('connect_error', (error) => {
    console.error('DEBUG - Socket connection error:', error);
    console.log('DEBUG - Socket connection error details:', {
      message: error.message,
      name: error.name
    });
  });

  socket.on('disconnect', (reason) => {
    console.log('DEBUG - Socket disconnected. Reason:', reason);
    if (reason === 'io server disconnect') {
      // Server initiated disconnect, try to reconnect
      socket?.connect();
    }
  });

  socket.on('error', (error) => {
    console.error('DEBUG - Socket error:', error);
  });

  // Listen for streaming updates
  socket.on('streaming_update', (data) => {
    console.log('DEBUG - Received streaming update:', data);
    if (streamingCallback) {
      console.log('DEBUG - Calling streaming callback with data');
      streamingCallback(data);
    } else {
      console.log('DEBUG - No streaming callback registered');
    }
  });

  return socket;
};

let agentPort: number | null = null;
let agentId: string | null = null;

export const initializeAgent = async () => {
  try {
    const extensionId = getExtensionId();
    const response = await fetch(`${SERVER_URL}/create_agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        extensionId
      }),
    });
    const data = await response.json();
    if (data.success) {
      agentPort = data.port;
      agentId = data.agentId;
      console.log(`Agent initialized on port ${agentPort} with ID ${agentId}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    return false;
  }
};

export const sendMessage = async (text: string): Promise<Message> => {
  if (!agentId) {
    throw new Error("Agent not initialized");
  }

  const extensionId = getExtensionId();
  console.log('DEBUG - Sending message:', { agentId, text, extensionId });
  
  try {
    const response = await fetch(`${SERVER_URL}/agent/${agentId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': chrome.runtime.getURL(""),
      },
      credentials: 'include',
      body: JSON.stringify({ text, extensionId })
    });

    if (!response.ok) {
      console.error('DEBUG - API Error:', {
        status: response.status,
        statusText: response.statusText
      });
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('DEBUG - API Response:', data);
    
    return {
      id: Date.now().toString(),
      text: data.message || "I'm not sure how to respond to that. Could you please rephrase?",
      type: 'bot',
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('DEBUG - Failed to send message:', error);
    throw error;
  }
};

export const searchToken = async (keyword: string) => {
  console.log("Searching for token:", keyword);
  const endpoint = `https://public-api.birdeye.so/defi/v3/search?chain=solana&keyword=${encodeURIComponent(
    keyword
  )}&target=token&sort_by=volume_24h_usd&sort_type=desc&offset=0&limit=1`;
  
  const response = await fetch(endpoint, {
    headers: {
      "X-API-KEY": BIRDEYE_API_KEY,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Search API request failed: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.success || !data.data?.items?.[0]) {
    throw new Error("Failed to search for token");
  }

  return data.data.items[0];
};

export const fetchTokenMetrics = async (tokenIdentifier: string): Promise<TokenMetrics> => {
  let address = tokenIdentifier;
  
  // If not a valid Solana address, search for the token
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(tokenIdentifier)) {
    const searchResult = await searchToken(tokenIdentifier);
    if (!searchResult.result?.[0]) {
      throw new Error(`No token found for symbol: ${tokenIdentifier}`);
    }
    address = searchResult.result[0].address;
  }

  const endpoint = `https://public-api.birdeye.so/defi/token_overview?address=${address}`;
  const response = await fetch(endpoint, {
    headers: {
      "X-API-KEY": BIRDEYE_API_KEY,
      Accept: "application/json",
      "x-chain": "solana",
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error("Failed to fetch token metrics");
  }

  return data.data;
}; 