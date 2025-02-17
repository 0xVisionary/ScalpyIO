import express from "express";
import cors from "cors";
import { createAgentRuntime, cleanupRuntime } from "./agent.js";
import { Server } from "socket.io";
import http from "http";

const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with CORS config
console.log("DEBUG - Initializing Socket.IO server");
export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
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
app.post("/create_agent", async (req, res) => {
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

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Agent management server running on port ${PORT}`);
});
