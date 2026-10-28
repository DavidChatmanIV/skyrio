// backend/utils/fieldCrypto.js
// AES-256-GCM for sensitive profile fields (Known Traveler Number, passport number).
// Set FIELD_ENCRYPTION_KEY on Render to a 32-byte base64 key:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
import crypto from "crypto";

function key() {
  const k = Buffer.from(process.env.FIELD_ENCRYPTION_KEY || "", "base64");
  if (k.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return k;
}

export function encryptField(plain) {
  if (plain == null || plain === "") return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptField(stored) {
  if (!stored) return null;
  const [v, iv, tag, data] = stored.split(":");
  if (v !== "v1") throw new Error("Unknown encryption version");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

// For showing "Known Traveler •••• 4821" without decrypting into the UI
export function last4(stored) {
  const plain = decryptField(stored);
  return plain ? plain.slice(-4) : null;
}
