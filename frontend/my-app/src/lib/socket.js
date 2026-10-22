import { io } from "socket.io-client";

// In production the frontend (Vercel) and backend (Render) are different
// hosts, so "/" would point the socket at Vercel, which can't carry
// WebSockets. Point it at the API host; locally it falls back to "/" so the
// Vite dev proxy keeps working.
const API_URL = import.meta.env.VITE_API_URL || "/";

export const socket = io(API_URL, {
  withCredentials: true,
  // Try WebSocket first, fall back to polling on networks that block it
  transports: ["websocket", "polling"],
  // Send the login token so the server can check who's joining a room
  auth: (cb) => cb({ token: localStorage.getItem("token") || "" }),
});
