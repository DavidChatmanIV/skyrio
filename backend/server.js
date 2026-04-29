import "dotenv/config";
import * as Sentry from "@sentry/node";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import compression from "compression";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

import apiRouter from "./routes/api/index.js";
import healthRouter from "./routes/health.routes.js";
import Contact from "./models/contact.js";
import { startJobs } from "./jobs/scheduler.js";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: 0.2,
  enabled: process.env.NODE_ENV === "production",
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);

const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN ||
  process.env.CLIENT_ORIGIN ||
  "http://localhost:5273";

const allowedOrigins = FRONTEND_ORIGIN.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (process.env.NODE_ENV !== "production") {
  const devExtras = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5273",
    "http://127.0.0.1:5273",
  ];

  devExtras.forEach((origin) => {
    if (!allowedOrigins.includes(origin)) {
      allowedOrigins.push(origin);
    }
  });
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

const corsOptions = {
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

if (process.env.NODE_ENV !== "production") {
  app.get("/__envcheck", (_req, res) => {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || "";
    res.json({
      dbPresent: !!uri,
      dbSample: uri ? uri.slice(0, 16) + "..." + uri.slice(-6) : "not set",
      allowedOrigins,
      nodeEnv: process.env.NODE_ENV || "not set",
      frontendOrigin: FRONTEND_ORIGIN,
    });
  });

  app.get("/__atlascheck", (_req, res) => {
    res.json({
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      provider: process.env.ATLAS_PROVIDER || "openai (default)",
      fallback: process.env.ATLAS_FALLBACK_PROVIDER || "not set",
    });
  });
}

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const MONGO_DB = process.env.MONGODB_DB || process.env.MONGO_DB;

async function connectMongo() {
  if (!MONGODB_URI) {
    console.error("❌ Missing MONGODB_URI — check your .env file.");
    process.exit(1);
  }

  const c = mongoose.connection;

  c.on("error", (err) => {
    console.error("❌ MongoDB error:", err.message);
  });

  c.on("disconnected", () => {
    console.warn(
      "⚠️  MongoDB disconnected. Check Atlas IP whitelist or network."
    );
  });

  c.on("reconnected", () => {
    console.log("✅ MongoDB reconnected.");
  });

  const safeUri = MONGODB_URI.replace(/:([^@]+)@/, ":***@");
  console.log(`🔌 Connecting to: ${safeUri.substring(0, 70)}...`);

  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: MONGO_DB || undefined,
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 7_000,
      socketTimeoutMS: 60_000,
    });

    console.log(`✅ MongoDB connected (db: ${c.name})`);
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    if (process.env.NODE_ENV !== "production") console.error(err);
    process.exit(1);
  }
}

app.get("/health/db", async (_req, res) => {
  const state = mongoose.connection.readyState;

  if (state !== 1 || !mongoose.connection.db) {
    return res.status(503).json({ ok: false, state, error: "DB not ready" });
  }

  try {
    await mongoose.connection.db.admin().ping();
    return res.json({ ok: true, state });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/", (_req, res) => res.send("🚀 Skyrio backend is running!"));

app.use("/health", healthRouter);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api", apiRouter);

app.post("/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body || {};

    if (!name || !email || !message) {
      return res
        .status(400)
        .json({ error: "Missing name, email, or message." });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "DB not ready." });
    }

    await new Contact({ name, email, message }).save();
    return res.json({ ok: true, message: "Thank you for reaching out!" });
  } catch (err) {
    console.error("❌ Contact error:", err);
    return res.status(500).json({ error: "Contact form failed." });
  }
});

app.use((req, _res, next) => {
  if (req.path.startsWith("/api")) {
    const err = new Error("Not found");
    err.status = 404;
    return next(err);
  }
  next();
});

Sentry.setupExpressErrorHandler(app);

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || "Server error" });
});

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: corsOptions,
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log(`🔥 Socket connected ${socket.id}`);

  socket.on("notifications:join", ({ userId }) => {
    if (userId) {
      socket.join(String(userId));
      console.log(`🔔 Notifications room joined: ${userId}`);
    }
  });

  socket.on("dm:join", ({ conversationId }) => {
    if (conversationId) socket.join(String(conversationId));
  });

  socket.on("dm:typing", ({ conversationId, fromUserId }) => {
    if (conversationId) {
      socket.to(String(conversationId)).emit("dm:typing", { fromUserId });
    }
  });

  socket.on("send_message", (payload) => {
    if (payload?.conversationId) {
      socket
        .to(String(payload.conversationId))
        .emit("message_received", payload);
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ Socket disconnected ${socket.id}`);
  });
});

async function shutdown(signal) {
  console.log(`\n🛑 ${signal} received — shutting down gracefully...`);
  try {
    await mongoose.connection.close();
    httpServer.close(() => {
      console.log("👋 Server closed.");
      process.exit(0);
    });
  } catch {
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("🚨 Unhandled rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("🚨 Uncaught exception:", err);
  process.exit(1);
});

await connectMongo();
startJobs();

const PORT = Number(process.env.PORT) || 4000;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 Skyrio API on :${PORT}`);
  console.log(`🌐 Allowed origins: ${allowedOrigins.join(", ")}`);
  console.log(`📦 Node env: ${process.env.NODE_ENV || "development"}\n`);
});

export { app, io, httpServer };
