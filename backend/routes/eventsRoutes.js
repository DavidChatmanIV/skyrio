// backend/routes/eventsRoutes.js
// Mount in your server file:  app.use("/api/events", eventsRoutes);
import { Router } from "express";
import { listEvents, getEvent } from "../controllers/eventsController.js";

const router = Router();

router.get("/", listEvents);
router.get("/:id", getEvent);

export default router;
