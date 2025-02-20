import {
  AgentRuntime,
  ModelProviderName,
  Clients,
  CacheManager,
  MemoryCacheAdapter,
} from "@elizaos/core";
import { DirectClient } from "@elizaos/client-direct";
import tradingBuddyPlugin from "./tradingBuddyPlugin.js";
import { solanaPlugin } from "@elizaos/plugin-solana";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import { elizaLogger } from "@elizaos/core";
import { CustomSqliteAdapter } from "./CustomSqliteAdapter.js";
import fetch from "node-fetch";

dotenv.config();

// Initialize database adapter
let sqliteDb;
try {
  sqliteDb = new Database("./db.sqlite", {
    readonly: false,
    fileMustExist: false,
  });
} catch (error) {
  console.error("Failed to initialize SQLite database:", error);
  process.exit(1);
}

// Initialize tables
const sqliteTables = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT DEFAULT 'User',
  username TEXT,
  details TEXT DEFAULT '{}',
  is_agent INTEGER DEFAULT 0,
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
  embedding BLOB DEFAULT NULL,
  userId TEXT NOT NULL,
  roomId TEXT NOT NULL DEFAULT 'default',
  agentId TEXT NOT NULL,
  "unique" INTEGER DEFAULT 0,
  createdAt INTEGER DEFAULT (unixepoch())
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
  console.error("Failed to create SQLite tables:", error);
  process.exit(1);
}

// Create database adapter
let db;
let memoryCacheAdapter;
let cacheManager;
try {
  db = new CustomSqliteAdapter(sqliteDb);
  memoryCacheAdapter = new MemoryCacheAdapter();
  cacheManager = new CacheManager(memoryCacheAdapter);
} catch (error) {
  console.error("Failed to initialize adapters:", error);
  process.exit(1);
}

const testAgent = {
  name: "Test Bot",
  modelProvider: ModelProviderName.OPENAI,
  model: "large",
  bio: ["I am an AI who loves helping developers and analyzing crypto tokens"],
  lore: ["I was created to assist with token analysis and trading questions"],
  messageExamples: [
    [
      { role: "user", content: "How can I help you?" },
      {
        role: "assistant",
        content:
          "I'd love to help you analyze tokens and answer your trading questions!",
      },
    ],
    [
      { role: "user", content: "how is it?" },
      {
        role: "assistant",
        content:
          "Let me check the token we were discussing and provide an update on its status.",
      },
    ],
  ],
  postExamples: [
    {
      content:
        "Just analyzed $BONK - strong liquidity and growing community! Trust score: 8/10 🚀",
      tags: ["crypto", "analysis", "solana"],
    },
    {
      content:
        "New token analysis: $JUP shows promising metrics with solid fundamentals. Market cap and volume trending up 📈",
      tags: ["trading", "metrics", "analysis"],
    },
    {
      content:
        "Quick safety check on $WIF: Verified contract ✅ Active development ✅ Growing holders 📈",
      tags: ["safety", "token", "analysis"],
    },
  ],
  settings: {
    secrets: {
      BIRDEYE_API_KEY: process.env.BIRDEYE_API_KEY,
    },
    memory: {
      enabled: true,
      contextWindow: 10, // Remember last 10 messages for context
      useLastToken: true, // Enable using last token context
    },
  },
  topics: ["cryptocurrency", "trading", "token analysis", "market metrics"],
  adjectives: ["analytical", "informative", "precise"],
  knowledge: [
    "I can analyze Solana tokens and provide detailed metrics",
    "I maintain context of our conversation and the last token we discussed",
    "I can answer follow-up questions about previously analyzed tokens",
  ],
  clients: [Clients.DIRECT],
  plugins: [tradingBuddyPlugin],
  system:
    "You are a helpful AI assistant specializing in crypto token analysis. You maintain conversation context and can discuss previously analyzed tokens.",
  style: {
    all: ["I communicate clearly and maintain context"],
    chat: [
      "I speak in a friendly and informative manner",
      "I reference previous context when appropriate",
      "I provide detailed analysis when discussing tokens",
    ],
  },
};

// Track active runtimes and ports
const runtimeCache = new Map();
let nextPort = 3001;

/**
 * Process a message through an agent's runtime
 */
export async function processMessage(agentId, messageData) {
  try {
    // Find the runtime data for this agent
    const runtimeData = Array.from(runtimeCache.values()).find(
      (data) => data.agentId === agentId
    );

    if (!runtimeData) {
      console.error(`No runtime found for agent ${agentId}`);
      throw new Error("Agent not found");
    }

    // Forward the request to the internal agent server
    const response = await fetch(
      `http://localhost:${runtimeData.port}/${agentId}/message`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageData),
      }
    );

    if (!response.ok) {
      throw new Error(`Agent server responded with ${response.status}`);
    }

    const data = await response.json();
    const messageResponse = Array.isArray(data) ? data[0] : data;

    return {
      agentId,
      message:
        messageResponse.response?.content ||
        messageResponse.text ||
        "Sorry, I couldn't process that message.",
      timestamp: new Date(),
    };
  } catch (error) {
    console.error("Error in processMessage:", error);
    throw error;
  }
}

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
    runtime.userId = userId;

    // Ensure user exists in database with extensionId as primary identifier
    try {
      await db.createAccount({
        id: userId,
        name: "User",
        username: `user_${userId.substring(0, 8)}`,
        details: "{}",
        is_agent: 0,
      });
      elizaLogger.info(`Created account for user ${userId}`);
    } catch (error) {
      // Ignore unique constraint error as user might already exist
      if (!error.message?.includes("UNIQUE constraint")) {
        elizaLogger.error(`Error creating account for user ${userId}:`, error);
        throw error;
      }
      elizaLogger.debug(`Account already exists for user ${userId}`);
    }

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
          return res.status(400).json({ error: "Missing required fields" });
        }

        const response = await runtime.handleMessage({
          content: text,
          userId,
          roomId,
          userName,
        });

        res.json({ response });
      } catch (error) {
        console.error("Error handling message:", error);
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
      userId,
    };

    runtimeCache.set(userId, runtimeData);
    console.log(
      `Agent initialized for user ${userId} on port ${port} with ID ${runtime.agentId}`
    );

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
      await new Promise((resolve) => runtimeData.server.close(resolve));
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
      userIds.map((userId) => createAgentRuntime(userId))
    );

    console.log("All agents started successfully");

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("Shutting down all agents...");
      await Promise.all(
        Array.from(runtimeCache.keys()).map((userId) => cleanupRuntime(userId))
      );
      process.exit(0);
    });

    return runtimes;
  } catch (error) {
    console.error("Failed to start agents:", error);
    // Cleanup any successful starts
    await Promise.all(
      Array.from(runtimeCache.keys()).map((userId) => cleanupRuntime(userId))
    );
    process.exit(1);
  }
}

// Example usage:
const userIds = ["user1", "user2", "user3"];
console.log("Starting agents for users...");
startAgentsForUsers(userIds).catch(console.error);

// Export functions for use in other files
export { createAgentRuntime, cleanupRuntime, runtimeCache, sqliteDb };
