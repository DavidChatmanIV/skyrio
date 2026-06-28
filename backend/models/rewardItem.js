import mongoose from "mongoose";

const { Schema } = mongoose;

// One real source of truth for the rewards catalog — previously split
// across two hardcoded, manually-synced lists (REWARDS_CATALOG in
// rewards.routes.js, DEFAULT_ITEMS in PassportRewards.jsx) that didn't
// even share the same fields. This unifies them.
//
// itemId is a separate stable string slug, NOT the same as Mongo's own
// _id — this matters because User.redeemedRewards already stores plain
// string slugs like "weekend_xp" for any items already redeemed before
// this model existed. Keeping itemId as the stable reference (rather than
// switching redeemedRewards to ObjectIds) means zero migration needed for
// any existing redemption history.
const RewardItemSchema = new Schema(
  {
    itemId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // Intentionally immutable after creation — see the PATCH route's
      // allowed-fields list, which excludes itemId on purpose. Changing
      // it later would orphan it from anyone's existing
      // User.redeemedRewards entries.
    },
    title: { type: String, required: true, trim: true },
    desc: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ["BOOST", "BADGE", "PERK", "LIMITED"],
    },
    cost: { type: Number, required: true, min: 0 },
    // Present in the original frontend data but never actually read
    // anywhere in PassportRewards.jsx's getStatus() logic — it's not
    // wired up to gate anything today. Kept here since it already
    // existed as data; setting it doesn't currently restrict an item to
    // any particular tier.
    level: { type: Number, default: 1 },
    featured: { type: Boolean, default: false },
    repeatable: { type: Boolean, default: false },
    // ⚠️ Named isNewItem, not isNew — isNew is a reserved Mongoose
    // pathname (every document has a built-in doc.isNew tracking whether
    // it's freshly created vs already saved). Naming a schema field isNew
    // shadows that internal property, which Mongoose explicitly warns
    // about as a functional risk, not just a style nitpick. The API
    // still exposes this as "isNew" in every request/response — only the
    // internal schema field name changed, so neither frontend file needs
    // to change at all; see the explicit translation in rewards.routes.js.
    isNewItem: { type: Boolean, default: false },
    // Soft-remove flag — same pattern as Challenge's active flag. A hard
    // delete would orphan anyone's existing redeemedRewards entry for
    // this item; this lets it disappear from what users see while
    // keeping redemption history intact.
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

const RewardItem =
  mongoose.models.RewardItem || mongoose.model("RewardItem", RewardItemSchema);
export default RewardItem;
