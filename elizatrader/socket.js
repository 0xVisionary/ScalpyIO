import { Server } from "socket.io";

// Define allowed origins (must match server.js)
const allowedOrigins = [
  /^http:\/\/localhost:/, // Any localhost port
  /^chrome-extension:\/\/.*/, // Any Chrome extension
  "https://scalpy-io-44e3093700f8.herokuapp.com", // Heroku server
];

let io = null;

export const initializeSocketIO = (server) => {
  if (io) return io;

  console.log("Initializing Socket.IO server");
  io = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        console.log("Socket.IO - Request from origin:", origin);

        // Allow requests with no origin
        if (!origin) {
          console.log("Socket.IO - No origin, allowing");
          return callback(null, true);
        }

        // Check if origin matches any allowed pattern
        const isAllowed = allowedOrigins.some((allowed) =>
          typeof allowed === "string"
            ? allowed === origin
            : allowed.test(origin)
        );

        if (isAllowed) {
          console.log("Socket.IO - Origin allowed:", origin);
          callback(null, true);
        } else {
          console.log("Socket.IO - Origin rejected:", origin);
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
      ],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    try {
      const { extensionId } = socket.handshake.query;
      console.log("DEBUG - Socket connection attempt");
      console.log("DEBUG - Socket ID:", socket.id);
      console.log("DEBUG - Query params:", socket.handshake.query);
      console.log("DEBUG - Origin:", socket.handshake.headers.origin);

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
