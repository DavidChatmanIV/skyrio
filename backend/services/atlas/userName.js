// backend/services/atlas/userName.js
// Your User model stores one `name` field, so take the first word as the first name.
export function firstNameOf(user) {
  return String(user?.name || user?.username || "").trim().split(/\s+/)[0] || "Traveler";
}
