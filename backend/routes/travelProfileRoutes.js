// backend/routes/travelProfileRoutes.js
// Mount in server.js:  app.use("/api/travel-profile", travelProfileRoutes);
import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import {
  getProfile,
  saveSelf,
  addCompanion,
  updateCompanion,
  removeCompanion,
  createCardSetupIntent,
  saveConfirmedCard,
} from "../controllers/travelProfileController.js";

const router = Router();

router.use(authRequired);
router.get("/", getProfile);
router.put("/self", saveSelf);
router.post("/companions", addCompanion);
router.put("/companions/:id", updateCompanion);
router.delete("/companions/:id", removeCompanion);
router.post("/card/setup-intent", createCardSetupIntent);
router.post("/card/confirm", saveConfirmedCard);

export default router;
