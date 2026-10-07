import express from "express";
import http from "http";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import { env, isAllowedClientOrigin } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { initSocket } from "./services/socket.js";
import authRoutes from "./routes/authRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import registrationRoutes from "./routes/registrationRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import ticketRoutes from "./routes/ticketRoutes.js";
import { startTicketHoldCleanupLoop } from "./services/ticketing.js";
import { startEventReminderLoop } from "./services/eventReminders.js";
import "./workers/emailWorker.js";
import "./workers/reminderWorker.js";
import "./workers/smsWorker.js";
import "./workers/refundWorker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

function normalizeClientIp(value = "") {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue) return "";

  const firstEntry = trimmedValue.split(",")[0].trim();
  if (firstEntry.startsWith("::ffff:")) return firstEntry.slice(7);
  return firstEntry;
}

function isPrivateIp(ip = "") {
  const normalizedIp = normalizeClientIp(ip).toLowerCase();
  if (!normalizedIp) return true;

  if (
    normalizedIp === "127.0.0.1" ||
    normalizedIp === "::1" ||
    normalizedIp === "localhost"
  ) {
    return true;
  }

  if (
    normalizedIp.startsWith("10.") ||
    normalizedIp.startsWith("192.168.") ||
    normalizedIp.startsWith("fc") ||
    normalizedIp.startsWith("fd") ||
    normalizedIp.startsWith("fe80:")
  ) {
    return true;
  }

  const privateRangeMatch = normalizedIp.match(/^172\.(\d{1,3})\./);
  if (!privateRangeMatch) return false;

  const secondOctet = Number(privateRangeMatch[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

async function lookupIpLocation(req, res) {
  try {
    const forwardedIp = normalizeClientIp(req.headers["x-forwarded-for"]);
    const requestIp =
      forwardedIp ||
      normalizeClientIp(req.ip) ||
      normalizeClientIp(req.socket?.remoteAddress);
    const lookupEndpoint =
      requestIp && !isPrivateIp(requestIp)
        ? `http://ip-api.com/json/${encodeURIComponent(
            requestIp,
          )}?fields=status,message,city,region,regionName,country,query`
        : "http://ip-api.com/json/?fields=status,message,city,region,regionName,country,query";

    const response = await fetch(lookupEndpoint, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return res.status(502).json({
        message: "Unable to fetch your current city right now.",
      });
    }

    const data = await response.json();
    if (data.status !== "success") {
      return res.status(502).json({
        message: data.message || "Unable to detect your current city.",
      });
    }

    res.set("Cache-Control", "no-store");
    res.json({
      city: data.city || "",
      region: data.regionName || data.region || "",
      country: data.country || "",
      ip: data.query || requestIp || "",
      source: "ip-api",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Unable to detect your current city.",
    });
  }
}

// Security & utils
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedClientOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf?.toString("utf8") || "";
    },
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());

// Basic rate limit
app.use("/api", rateLimit({ windowMs: 60 * 1000, max: 120 }));

// Static posters
const uploadsDir = path.resolve(__dirname, "../uploads");
app.use("/uploads", express.static(uploadsDir));

// API Routes (mounted later when implemented)
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.get("/api/location/current", lookupIpLocation);
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/tickets", ticketRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res
    .status(err.status || 500)
    .json({ message: err.message || "Server error" });
});

async function start() {
  await connectDB();
  initSocket(server);
  startTicketHoldCleanupLoop();
  startEventReminderLoop();

  async function tryListen(port) {
    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off("listening", onListening);
          reject(error);
        };

        const onListening = () => {
          server.off("error", onError);
          resolve();
        };

        server.once("error", onError);
        server.listen(port, onListening);
      });

      env.port = port;
      return port;
    } catch (err) {
      if (err && err.code === "EADDRINUSE") {
        throw new Error(
          `Port ${port} is already in use. Please stop the conflicting process and try again.`,
        );
      }

      throw err;
    }
  }

  await tryListen(env.port);

  console.log(`Server running on http://localhost:${env.port}`);
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
