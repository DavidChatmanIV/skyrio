import React, { useEffect, useMemo, useState, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";

const API = import.meta.env.VITE_API_URL || "";

function safeParse(json) {
  try {
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

function normalizeUser(u) {
  if (!u || typeof u !== "object") return null;
  const id = u._id || u.id;
  return { ...u, ...(id ? { _id: id, id } : {}) };
}

function pickError(data) {
  return data?.error || data?.message || "Request failed";
}

function getStoredToken() {
  return localStorage.getItem("token") || null;
}

function buildAuthHeaders(extraHeaders = {}) {
  const token = getStoredToken();
  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(() =>
    safeParse(localStorage.getItem("user"))
  );
  const [token, setToken] = useState(() => getStoredToken());
  const [guestFlag, setGuestFlag] = useState(
    () => localStorage.getItem("skyrio_guest") === "1"
  );
  const [loading, setLoading] = useState(true);

  const isAuthed = !!(token && (user?.id || user?._id));
  const isGuest = !!guestFlag && !isAuthed;

  const setSession = useCallback(
    ({ user: nextUser, token: nextToken } = {}) => {
      localStorage.removeItem("skyrio_guest");
      setGuestFlag(false);
      if (nextUser) {
        const normalized = normalizeUser(nextUser);
        setUser(normalized);
        localStorage.setItem("user", JSON.stringify(normalized));
      }
      if (nextToken) {
        setToken(nextToken);
        localStorage.setItem("token", nextToken);
      }
    },
    []
  );

  const clearSession = useCallback(() => {
    setUser(null);
    setToken(null);
    setGuestFlag(false);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("skyrio_guest");
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: buildAuthHeaders(),
      });
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const authFetch = useCallback(
    async (url, options = {}) => {
      const res = await fetch(url, {
        credentials: "include",
        ...options,
        headers: buildAuthHeaders(options.headers || {}),
      });
      if (res.status === 401) {
        clearSession();
      }
      return res;
    },
    [clearSession]
  );

  const restoreSession = useCallback(async () => {
    try {
      const existingToken = getStoredToken();

      if (!existingToken) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${API}/api/auth/check`, {
        method: "GET",
        credentials: "include",
        headers: buildAuthHeaders(),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        clearSession();
        setLoading(false);
        return;
      }

      const nextUser = normalizeUser(data?.user || data?.profile || data);

      if (nextUser?.id || nextUser?._id) {
        // Fetch full profile to get bio, city, homeBase
        try {
          const profileRes = await fetch(`${API}/api/profile/me`, {
            method: "GET",
            credentials: "include",
            headers: buildAuthHeaders(),
          });
          if (profileRes.ok) {
            const profileData = await profileRes.json().catch(() => ({}));
            const fullUser = normalizeUser(profileData?.user || nextUser);
            setUser(fullUser);
            localStorage.setItem("user", JSON.stringify(fullUser));
          } else {
            setUser(nextUser);
            localStorage.setItem("user", JSON.stringify(nextUser));
          }
        } catch {
          setUser(nextUser);
          localStorage.setItem("user", JSON.stringify(nextUser));
        }
      } else {
        // Server responded ok but no user shape — keep cached user
        const cachedUser = safeParse(localStorage.getItem("user"));
        if (cachedUser) {
          setUser(cachedUser);
        } else {
          clearSession();
        }
      }
    } catch (err) {
      console.error("restoreSession failed:", err);
      // Network error — don't clear session, keep cached data
      const cachedUser = safeParse(localStorage.getItem("user"));
      const cachedToken = getStoredToken();
      if (cachedUser && cachedToken) {
        setUser(cachedUser);
        setToken(cachedToken);
      }
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "user") setUser(safeParse(e.newValue));
      if (e.key === "token") setToken(e.newValue || null);
      if (e.key === "skyrio_guest") setGuestFlag(e.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const available = useCallback(async ({ email, username } = {}) => {
    const params = new URLSearchParams();
    if (email) params.set("email", String(email).trim().toLowerCase());
    if (username) params.set("username", String(username).trim());
    if ([...params.keys()].length === 0) {
      return { ok: false, error: "Provide email and/or username" };
    }
    const res = await fetch(`${API}/api/auth/available?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: pickError(data) };
    return data;
  }, []);

  const login = useCallback(
    async ({ identity, emailOrUsername, email, password } = {}) => {
      const id = String(identity || emailOrUsername || email || "").trim();
      if (!id || !password) {
        throw new Error("Email/username and password are required");
      }
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ emailOrUsername: id, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(pickError(data));
      }
      if (!data?.token || !data?.user) {
        throw new Error("Login response missing token or user");
      }
      setSession({ token: data.token, user: data.user });
      return true;
    },
    [setSession]
  );

  const signup = useCallback(
    async ({ name, email, password, username } = {}) => {
      if (!email || !password) {
        throw new Error("Email and password are required");
      }
      const res = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name || "",
          email,
          password,
          username: username || "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(pickError(data));
      }
      if (!data?.token || !data?.user) {
        throw new Error("Register response missing token or user");
      }
      setSession({ token: data.token, user: data.user });
      return true;
    },
    [setSession]
  );

  const continueAsGuest = useCallback(() => {
    clearSession();
    localStorage.setItem("skyrio_guest", "1");
    setGuestFlag(true);
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthed,
      isGuest,
      loading,
      setSession,
      logout,
      login,
      signup,
      available,
      continueAsGuest,
      setUser,
      setToken,
      authFetch,
      restoreSession,
    }),
    [
      user,
      token,
      isAuthed,
      isGuest,
      loading,
      setSession,
      logout,
      login,
      signup,
      available,
      continueAsGuest,
      authFetch,
      restoreSession,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
