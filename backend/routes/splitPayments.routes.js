// backend/routes/splitPayments.routes.js
// Retired. The old "pay your share" links worked without logging in, so
// anyone with the link could see and pay someone else's share.
//
// Sync Together now has each traveler book and pay for their own part
// from the trip page (logged in). Shared rooms live under
//   /api/sync-together/:id/shared-rooms/...
//
// This stub stays mounted so old links get a clear answer instead of a 404.
// You can delete this file and its mount line in routes/api/index.js
// whenever you like.

import { Router } from "express";

const router = Router();

router.use((_req, res) =>
  res.status(410).json({
    ok: false,
    message:
      "This payment link is no longer used. Open the trip in Sync Together to pay for your part.",
  })
);

export default router;
