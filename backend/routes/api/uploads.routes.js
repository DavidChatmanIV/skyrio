import { Router } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth } from "../../middleware/requireAuth.js";
import { rateLimit } from "../../services/skyhubSafety.js";

const router = Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn("[uploads] Cloudinary is not fully configured — uploads will fail.");
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// Memory storage — files go straight to Cloudinary, never to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error("Only photos (JPG, PNG, WebP or HEIC) can be uploaded."), { status: 400 }));
  },
});

// The browser's file type can be faked, so check the file's first bytes too.
function looksLikeImage(buf) {
  if (!buf || buf.length < 12) return false;
  const hex = buf.subarray(0, 12).toString("hex");
  const ascii = buf.subarray(4, 12).toString("latin1");
  return (
    hex.startsWith("ffd8ff") || // JPEG
    hex.startsWith("89504e470d0a1a0a") || // PNG
    (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") ||
    /^ftyp(heic|heix|hevc|mif1|msf1|heis|avif)/.test(ascii) // HEIC/HEIF
  );
}

// What each kind of upload becomes. Any transformation here is applied
// when the photo is stored, and Cloudinary drops the photo's hidden data
// (EXIF — including the GPS location it was taken at) when it does.
const PURPOSES = {
  avatar: {
    folder: "skyrio/avatars",
    transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }, { quality: "auto" }],
  },
  post: {
    folder: "skyrio/skyhub",
    transformation: [{ width: 1600, height: 1600, crop: "limit" }, { quality: "auto" }],
  },
};

// POST /api/uploads/image?purpose=avatar|post   (form field: "file")
router.post(
  "/image",
  requireAuth,
  rateLimit("upload"),
  (req, res, next) =>
    upload.single("file")(req, res, (err) => {
      if (!err) return next();
      const tooBig = err.code === "LIMIT_FILE_SIZE";
      return res.status(400).json({
        ok: false,
        message: tooBig ? "That photo is too large. Photos can be up to 8 MB." : err.message || "Upload failed",
      });
    }),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, message: "No file uploaded" });
      }
      if (!looksLikeImage(req.file.buffer)) {
        return res.status(400).json({ ok: false, message: "That file isn't a photo we can use." });
      }
      const purpose = PURPOSES[req.query.purpose] ? req.query.purpose : "avatar";
      const opts = PURPOSES[purpose];

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: opts.folder,
            resource_type: "image",
            transformation: opts.transformation,
            format: "jpg", // HEIC from iPhones becomes a JPG every browser can show
          },
          (error, r) => (error ? reject(error) : resolve(r))
        );
        stream.end(req.file.buffer);
      });

      return res.json({ ok: true, url: result.secure_url, public_id: result.public_id });
    } catch (err) {
      console.error("Upload error:", err?.message || err);
      return res.status(500).json({ ok: false, message: "Upload failed. Please try again." });
    }
  }
);

export default router;
