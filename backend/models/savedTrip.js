import mongoose from "mongoose";

const { Schema } = mongoose;

const SavedTripSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    tripType: {
      type: String,
      enum: ["flight", "hotel", "activity", "package", "custom"],
      default: "custom",
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    destination: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    image: {
      type: String,
      default: "",
      trim: true,
    },

    price: {
      type: Number,
      default: 0,
      min: 0,
    },

    currency: {
      type: String,
      default: "USD",
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },

    startDate: {
      type: String,
      default: "",
    },

    endDate: {
      type: String,
      default: "",
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

/* -----------------------------
   Compound Index (important)
------------------------------ */
// Helps queries like: "get my saved trips sorted"
SavedTripSchema.index({ user: 1, createdAt: -1 });

/* -----------------------------
   Safe JSON output
------------------------------ */
SavedTripSchema.methods.toSafeJSON = function () {
  return {
    id: this._id.toString(),
    tripType: this.tripType,
    title: this.title,
    destination: this.destination,
    image: this.image,
    price: this.price,
    currency: this.currency,
    startDate: this.startDate,
    endDate: this.endDate,
    metadata: this.metadata,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

/* -----------------------------
   Transform output
------------------------------ */
SavedTripSchema.set("toJSON", {
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

/* -----------------------------
   Export
------------------------------ */
const SavedTrip =
  mongoose.models.SavedTrip || mongoose.model("SavedTrip", SavedTripSchema);

export default SavedTrip;