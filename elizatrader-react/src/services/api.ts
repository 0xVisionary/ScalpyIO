import { Message } from '../types';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = "https://scalpy-io-44e3093700f8.herokuapp.com";

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
    withCredentials: true
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
      socket?.connect();
    }
  });

  socket.on('error', (error) => {
    console.error('DEBUG - Socket error:', error);
  });

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
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        extensionId
      }),
      credentials: 'include',
      mode: 'cors'
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
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      mode: 'cors',
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