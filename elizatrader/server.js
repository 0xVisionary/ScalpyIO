import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createAgentRuntime, cleanupRuntime, processMessage } from "./agent.js";
import http from "http";
import { initializeSocketIO } from "./socket.js";

const app = express();

// Define allowed origins
const allowedOrigins = [
  /^http:\/\/localhost:/, // Any localhost port
  /^chrome-extension:\/\/.*/, // Any Chrome extension
  "https://scalpy-io-44e3093700f8.herokuapp.com", // Heroku server
];

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(limiter);

// Create more strict rate limit for agent creation
const createAgentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Limit each IP to 5 agent creations per hour
  message:
    "Too many agent creation attempts from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log("Request from origin:", origin);

  // Allow requests with no origin (like mobile apps or curl requests)
  if (!origin) {
    console.log("No origin, allowing");
    return next();
  }

  // Check if origin matches any allowed pattern
  const isAllowed = allowedOrigins.some((allowed) =>
    typeof allowed === "string" ? allowed === origin : allowed.test(origin)
  );

  if (isAllowed) {
    console.log("Origin allowed:", origin);
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    next();
  } else {
    console.log("Origin rejected:", origin);
    res.status(403).send("CORS not allowed");
  }
});

// Handle preflight requests for all routes
app.options("*", (req, res) => {
  const origin = req.headers.origin;
  console.log("Handling preflight request from:", origin);

  // Check if origin is allowed
  const isAllowed = allowedOrigins.some((allowed) =>
    typeof allowed === "string" ? allowed === origin : allowed.test(origin)
  );

  if (isAllowed) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin"
    );
    res.header("Access-Control-Allow-Credentials", "true");
    res.status(200).send();
  } else {
    res.status(403).send("CORS not allowed");
  }
});

app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
export const io = initializeSocketIO(server);

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
    console.log("Request origin:", req.headers.origin);

    // Set CORS headers explicitly for this route
    res.header("Access-Control-Allow-Origin", req.headers.origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin"
    );

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
