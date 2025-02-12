import { AgentRuntime, ModelProviderName, Clients, CacheManager, MemoryCacheAdapter } from '@elizaos/core';
import { DirectClient } from "@elizaos/client-direct";
import { SqliteDatabaseAdapter } from "@elizaos/adapter-sqlite";
import tradingBuddyPlugin from './tradingBuddyPlugin.js';
import { solanaPlugin } from "@elizaos/plugin-solana";
import Database from "better-sqlite3";
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';

dotenv.config();

// Initialize database adapter
let sqliteDb;
try {
  sqliteDb = new Database("./db.sqlite", {
    readonly: false,
    fileMustExist: false,
  });
} catch (error) {
  console.error('Failed to initialize SQLite database:', error);
  process.exit(1);
}

// Initialize tables
const sqliteTables = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT,
  username TEXT,
  email TEXT UNIQUE,
  avatarUrl TEXT,
  details TEXT DEFAULT '{}',
  is_agent INTEGER DEFAULT 0,
  location TEXT,
  profile_line TEXT,
  signed_tos INTEGER DEFAULT 0,
  createdAt INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  createdAt INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  roomId TEXT NOT NULL,
  userState TEXT,
  last_message_read TEXT,
  createdAt INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB,
  userId TEXT NOT NULL,
  roomId TEXT NOT NULL,
  agentId TEXT NOT NULL,
  "unique" INTEGER DEFAULT 0,
  createdAt INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts
  USING fts5(content, content_rowid=id);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  roomId TEXT NOT NULL,
  userId TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  objectives TEXT NOT NULL,
  createdAt INTEGER DEFAULT (unixepoch())
);
`;

// Initialize tables
try {
  // Create tables
  sqliteDb.exec(sqliteTables);
} catch (error) {
  console.error('Failed to create SQLite tables:', error);
  process.exit(1);
}

// Create database adapter
let db;
let memoryCacheAdapter;
let cacheManager;
try {
  db = new SqliteDatabaseAdapter(sqliteDb);
  memoryCacheAdapter = new MemoryCacheAdapter();
  cacheManager = new CacheManager(
    memoryCacheAdapter
  );
} catch (error) {
  console.error('Failed to initialize adapters:', error);
  process.exit(1);
}

const testAgent = {
  name: "Test Bot",
  modelProvider: ModelProviderName.OPENAI,
  model: "large",
  bio: ["I am an AI who loves helping developers"],
  lore: ["I was created to assist with coding questions"],
  messageExamples: [
    [
      { role: "user", content: "How can I help you?" },
      { role: "assistant", content: "I'd love to discuss programming and technology!" }
    ]
  ],
  settings:{
    "secrets": {
      "BIRDEYE_API_KEY":"3231b35365f94d32818c356d73f598ab"
    },
  },
  postExamples: ["Just learned about a cool new JavaScript feature!"],
  topics: ["technology", "programming", "web development"],
  adjectives: ["helpful", "knowledgeable", "friendly"],
  knowledge: [
    "JavaScript is a programming language",
    "Node.js is a JavaScript runtime",
    "MongoDB is a NoSQL database"
  ],
  clients: [Clients.DIRECT],
  plugins: [tradingBuddyPlugin],
  system: "You are a helpful AI assistant who loves to talk about technology.",
  style: {
    all: ["I communicate clearly and precisely"],
    chat: [
      "I speak in a friendly and informative manner",
      "I use technical terms when appropriate",
      "I like to give examples"
    ],
    post: ["I write engaging and informative posts about technology"]
  }
};

// Track active runtimes and ports
const runtimeCache = new Map();
let nextPort = 3001;

async function createAgentRuntime(userId) {
  const port = nextPort++;
  
  try {
    // Initialize runtime with the exact test agent config
    const runtime = new AgentRuntime({
      databaseAdapter: db,
      cacheManager: cacheManager,
      token: process.env.OPENAI_API_KEY,
      modelProvider: ModelProviderName.OPENAI,
      character: testAgent,
      plugins: [tradingBuddyPlugin].filter(Boolean),
    });

    await runtime.initialize();

    // Create express app and server
    const app = express();
    app.use(express.json());
    const server = http.createServer(app);

    // Initialize DirectClient
    const client = new DirectClient();
    client.registerAgent(runtime);
    runtime.clients = [client];

    // Setup message handling
    app.post(`/${runtime.agentId}/message`, async (req, res) => {
      try {
        const { text, userId, roomId, userName } = req.body;
        
        if (!text || !userId || !roomId || !userName) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const response = await runtime.handleMessage({
          content: text,
          userId,
          roomId,
          userName
        });

        res.json({ response: response.content });
      } catch (error) {
        console.error('Error handling message:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Start the server and client
    await new Promise((resolve) => server.listen(port, resolve));
    await client.start(server, app);

    const runtimeData = {
      runtime,
      client,
      server,
      port,
      agentId: runtime.agentId,
      userId
    };

    runtimeCache.set(userId, runtimeData);
    
    console.log(`Agent initialized for user ${userId} on port ${port} with ID ${runtime.agentId}`);
    
    return runtimeData;
  } catch (error) {
    console.error(`Failed to create agent runtime for user ${userId}:`, error);
    throw error;
  }
}

async function cleanupRuntime(userId) {
  const runtimeData = runtimeCache.get(userId);
  if (runtimeData) {
    try {
      await runtimeData.client.stop();
      await new Promise(resolve => runtimeData.server.close(resolve));
      runtimeCache.delete(userId);
      console.log(`Cleaned up runtime for user ${userId}`);
    } catch (error) {
      console.error(`Error cleaning up runtime for user ${userId}:`, error);
    }
  }
}

// Example of creating agents for multiple users
async function startAgentsForUsers(userIds) {
  try {
    // Start an agent for each user
    const runtimes = await Promise.all(
      userIds.map(userId => createAgentRuntime(userId))
    );

    console.log("All agents started successfully");

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down all agents...');
      await Promise.all(
        Array.from(runtimeCache.keys()).map(userId => cleanupRuntime(userId))
      );
      process.exit(0);
    });

    return runtimes;
  } catch (error) {
    console.error("Failed to start agents:", error);
    // Cleanup any successful starts
    await Promise.all(
      Array.from(runtimeCache.keys()).map(userId => cleanupRuntime(userId))
    );
    process.exit(1);
  }
}

// Example usage:
const userIds = ['user1', 'user2', 'user3'];
console.log("Starting agents for users...");
startAgentsForUsers(userIds).catch(console.error);

// Export functions for use in other files
export {
  createAgentRuntime,
  cleanupRuntime,
  runtimeCache
}; 