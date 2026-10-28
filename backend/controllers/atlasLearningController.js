// backend/controllers/atlasLearningController.js
// Backs the "What Atlas knows about you" page: see, edit, switch off, or delete anything.
import AtlasLearnedPreference, { LEARNING_CATEGORIES } from "../models/AtlasLearnedPreference.js";
import User from "../models/user.js";

const SOURCE_LABEL = {
  stated: "You told Atlas",
  bookings: "From your trips",
  choices: "From options you picked",
  feedback: "From your feedback",
};

const view = (r) => ({
  id: String(r._id),
  category: r.category,
  text: r.text,
  source: r.source,
  sourceLabel: SOURCE_LABEL[r.source],
  // Plain words instead of a number
  strength: r.source === "stated" || r.editedByUser ? "You said so" : r.confidence >= 0.75 ? "Strong pattern" : r.confidence >= 0.5 ? "Noticing a pattern" : "Still learning",
  active: r.active,
  updatedAt: r.updatedAt,
});

// GET /api/atlas/learning
export async function listLearning(req, res) {
  const [user, rows] = await Promise.all([
    User.findById(req.user.id, { atlasLearningEnabled: 1 }).lean(),
    AtlasLearnedPreference.find({ user: req.user.id }).sort({ category: 1, confidence: -1 }).lean(),
  ]);
  res.json({
    enabled: user?.atlasLearningEnabled !== false,
    categories: LEARNING_CATEGORIES,
    items: rows.map(view),
  });
}

// PATCH /api/atlas/learning/:id   { text?, active? }
export async function updateLearning(req, res) {
  const set = {};
  if (typeof req.body.active === "boolean") set.active = req.body.active;
  if (typeof req.body.text === "string") {
    const t = req.body.text.trim().slice(0, 200);
    if (!t) return res.status(400).json({ error: "Can't be empty" });
    set.text = t;
    set.editedByUser = true;
    set.confidence = 0.9; // the user's own words are treated as stated
  }
  const r = await AtlasLearnedPreference.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { $set: set }, { new: true }).lean();
  if (!r) return res.status(404).json({ error: "Not found" });
  res.json(view(r));
}

// DELETE /api/atlas/learning/:id
export async function deleteLearning(req, res) {
  await AtlasLearnedPreference.deleteOne({ _id: req.params.id, user: req.user.id });
  res.json({ ok: true });
}

// DELETE /api/atlas/learning   (clear everything)
export async function clearLearning(req, res) {
  const { deletedCount } = await AtlasLearnedPreference.deleteMany({ user: req.user.id });
  res.json({ ok: true, deleted: deletedCount });
}

// PUT /api/atlas/learning/settings   { enabled }
export async function setLearningEnabled(req, res) {
  const enabled = Boolean(req.body.enabled);
  await User.updateOne({ _id: req.user.id }, { $set: { atlasLearningEnabled: enabled } });
  res.json({ enabled });
}
