
// src/index.ts
// HTTP server + Socket.IO bootstrap
// 1) Import dependencies

import "dotenv/config"; // Loads environment variables from .env
import express, { Request, Response, NextFunction } from "express"; // HTTP server and routes
import http from "http"; // Required by Socket.IO to bind to the HTTP server
import cors from "cors"; // CORS configuration
import { Server as SocketIOServer } from "socket.io"; // Socket.IO server
import { ratesRouter } from "./routes/rates.routes.js";
import { getLatestRates } from "./rates.service.js";
import { CORS_ORIGIN, PORT } from "./helpers/config.js";

// 2) Create Express app

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use("/api/rates", ratesRouter); // All /api/rates routes are defined in ratesRouter

// 3) Create HTTP server and configure WebSockets

const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: CORS_ORIGIN },
});

// Handle client connections

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Prevent spam from the frontend
  let lastRequest = 0;

  socket.on("rates:get", async () => {
    if (Date.now() - lastRequest < 500) return;
    lastRequest = Date.now();

    try {
      const rates = await getLatestRates();
      socket.emit("rates:data", rates);
    } catch (error) {
      socket.emit("rates:error", "Failed to load rates");
    }
  });
});

// Start server

httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Health check endpoint (used by deployment platforms)
app.get("/healthz", (_req: Request, res: Response) =>
  res.json({ ok: true })
);

// Error middlewares

app.use((_req: Request, res: Response) =>
  res.status(404).json({ error: "Not Found" })
);

app.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
);
