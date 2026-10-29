import rateLimit from "express-rate-limit";

// Guests can now hold fares and rooms, so cap how many holds one visitor
// can start. Needs `app.set("trust proxy", 1)` on Render, otherwise every
// visitor shares the proxy's IP and one limit applies to everyone.
export const holdLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message:
      "Too many booking attempts. Please wait a few minutes and try again.",
  },
});
