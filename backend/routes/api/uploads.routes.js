import { Router } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary storage — avatars folder, auto format + quality
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "skyrio/avatars",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 400, height: 400, crop: "fill", gravity: "face" },
    ],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// POST /api/uploads/image
router.post("/image", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "No file uploaded" });
    }

    return res.json({
      ok: true,
      url: req.file.path,
      public_id: req.file.filename,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ ok: false, message: "Upload failed" });
  }
});

export default router;
