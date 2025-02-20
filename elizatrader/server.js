import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createAgentRuntime, cleanupRuntime, processMessage } from "./agent.js";
import { Server } from "socket.io";
import http from "http";

const app = express();

// Define allowed origins
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173", // Vite dev server
  "https://scalpy-server-41f6c3cfd811.herokuapp.com",
  /^chrome-extension:\/\/.*/, // Allow any Chrome extension
];

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all routes
app.use(limiter);

// Create more strict rate limit for agent creation
const createAgentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 agent creations per hour
  message:
    "Too many agent creation attempts from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure CORS for Express
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      // Check if the origin is allowed
      const isAllowed = allowedOrigins.some((allowed) =>
        typeof allowed === "string" ? allowed === origin : allowed.test(origin)
      );

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
  })
);

app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with CORS config
console.log("Initializing Socket.IO server");
export const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      const isAllowed = allowedOrigins.some((allowed) =>
        typeof allowed === "string" ? allowed === origin : allowed.test(origin)
      );
      callback(null, isAllowed);
    },
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  try {
    const { extensionId } = socket.handshake.query;
    console.log("DEBUG - Socket connection attempt");
    console.log("DEBUG - Socket ID:", socket.id);
    console.log("DEBUG - Query params:", socket.handshake.query);

    if (!extensionId) {
      console.error("DEBUG - No extension ID provided in connection");
      socket.disconnect();
      return;
    }

    console.log("DEBUG - Client connected:", {
      extensionId,
      socketId: socket.id,
    });
    socket.join(extensionId);
    console.log("DEBUG - Client joined room:", extensionId);

    socket.on("disconnect", () => {
      console.log("DEBUG - Client disconnected:", {
        extensionId,
        socketId: socket.id,
      });
    });
  } catch (error) {
    console.error("DEBUG - Error handling socket connection:", error);
    socket.disconnect();
  }
});

// Create new agent runtime
app.post("/create_agent", createAgentLimiter, async (req, res) => {
  try {
    const { extensionId } = req.body;
    console.log("DEBUG - Creating agent for extensionId:", extensionId);

    if (!extensionId) {
      return res.status(400).json({ error: "extensionId is required" });
    }

    const runtimeData = await createAgentRuntime(extensionId);
    console.log("DEBUG - Agent created:", {
      extensionId,
      agentId: runtimeData.agentId,
      port: runtimeData.port,
    });

    res.json({
      success: true,
      port: runtimeData.port,
      agentId: runtimeData.agentId,
    });
  } catch (error) {
    console.error("Failed to create agent:", error);
    res.status(500).json({ error: error.message });
  }
});

// Cleanup agent runtime
app.post("/cleanup_agent", async (req, res) => {
  try {
    const { extensionId } = req.body;
    if (!extensionId) {
      return res.status(400).json({ error: "extensionId is required" });
    }

    await cleanupRuntime(extensionId);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to cleanup agent:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add message route
app.post("/agent/:agentId/message", async (req, res) => {
  try {
    const { agentId } = req.params;
    const { text, extensionId } = req.body;

    if (!text || !extensionId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log("Processing message for agent:", agentId);
    const response = await processMessage(agentId, {
      text,
      userId: extensionId,
      roomId: extensionId,
      userName: `user_${extensionId}`,
    });

    res.json(response);
  } catch (error) {
    console.error("Error processing message:", error);
    res.status(500).json({ error: "Failed to process message" });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Agent management server running on port ${PORT}`);
});
