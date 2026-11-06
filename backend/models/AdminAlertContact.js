// Phone numbers that get texted when something on Skyrio needs a person.
import mongoose from "mongoose";

const adminAlertContactSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 40, default: "" },
    // Stored in E.164 format, e.g. +12015551234
    phone: { type: String, required: true, unique: true, trim: true },
    enabled: { type: Boolean, default: true },
    alerts: {
      supportUrgent: { type: Boolean, default: true },
      supportAll: { type: Boolean, default: false },
      cancellations: { type: Boolean, default: true },
      takedowns: { type: Boolean, default: true },
    },
    lastTestAt: { type: Date },
    lastAlertAt: { type: Date },
    addedBy: { type: String, default: "" }, // admin email
  },
  { timestamps: true }
);

export default mongoose.models.AdminAlertContact ||
  mongoose.model("AdminAlertContact", adminAlertContactSchema);
