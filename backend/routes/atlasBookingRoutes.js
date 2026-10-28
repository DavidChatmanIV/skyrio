// backend/routes/atlasBookingRoutes.js
// Mount in server.js:  app.use("/api/atlas/proposals", atlasBookingRoutes);
//
// Webhook backup (add to your existing Stripe payments webhook handler):
//   case "payment_intent.succeeded":
//     if (event.data.object.metadata?.source === "atlas") {
//       await finalizeProposal(event.data.object.metadata.proposalId);
//     }
//     break;
import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import {
  getProposal,
  confirmProposal,
  finalizeAfterAction,
  cancelProposal,
} from "../controllers/atlasBookingController.js";

const router = Router();

router.use(authRequired);
router.get("/:id", getProposal);
router.post("/:id/confirm", confirmProposal);
router.post("/:id/finalize", finalizeAfterAction);
router.post("/:id/cancel", cancelProposal);

export default router;
