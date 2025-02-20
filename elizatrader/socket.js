import { Server } from "socket.io";

// Define allowed origins
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173", // Vite dev server
  "https://scalpy-server-41f6c3cfd811.herokuapp.com",
  /^chrome-extension:\/\/.*/, // Allow any Chrome extension
];

let io = null;

export const initializeSocketIO = (server) => {
  if (io) return io;

  console.log("Initializing Socket.IO server");
  io = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        if (!origin) {
          return callback(null, true);
        }
        const isAllowed = allowedOrigins.some((allowed) =>
          typeof allowed === "string"
            ? allowed === origin
            : allowed.test(origin)
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

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized");
  }
  return io;
};
