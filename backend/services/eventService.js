/**
 * eventService.js — backend/services/eventService.js
 */

import Event from "../models/event.js";

export async function logEvent(userId, eventType, metadata = {}) {
  try {
    await Event.create({ userId, eventType, metadata });
  } catch (err) {
    // Never let event logging break the actual user-facing action
    console.error("[eventService] logEvent failed:", eventType, err.message);
  }
}

export async function getRecentEvents(userId, days = 30, eventTypes = null) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const query = { userId, timestamp: { $gte: since } };
  if (eventTypes) query.eventType = { $in: eventTypes };
  return Event.find(query).sort({ timestamp: -1 });
}
