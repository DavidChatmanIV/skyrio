import { Router } from "express";
import {
  lookupDestination,
  searchExcursions,
  getExcursionDetail,
} from "./excursions.controller.js";

const router = Router();

// GET /api/excursions/destinations — place name → Viator destinationId
router.get("/destinations", lookupDestination);

// GET /api/excursions/search
router.get("/search", searchExcursions);

// GET /api/excursions/:productCode — single excursion detail
router.get("/:productCode", getExcursionDetail);

export default router;
