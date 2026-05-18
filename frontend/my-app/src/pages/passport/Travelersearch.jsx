import React, { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, MapPin } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import { apiUrl } from "@/lib/api";
import FollowButton from "./FollowButton";


export default function TravelerSearch() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const doSearch = useCallback(
    async (q) => {
      if (!q || q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          apiUrl(`/api/users/search?q=${encodeURIComponent(q)}&limit=8`),
          {
            credentials: "include",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        const data = await res.json();
        if (data?.ok) setResults(data.users || []);
        else setResults([]);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val.trim()), 300);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
  };

  const showDropdown = focused && query.length >= 2;

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "100%" }}>
      {/* ── Search input ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.05)",
          border: focused
            ? "1px solid rgba(255,138,42,0.4)"
            : "1px solid rgba(255,255,255,0.08)",
          transition: "border-color 0.2s",
        }}
      >
        <Search size={16} color="rgba(255,255,255,0.35)" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          placeholder="Search travelers..."
          style={{
            flex: 1,
            background: "none",
            border: "none",
            outline: "none",
            color: "#fff",
            fontSize: 14,
            fontFamily: "inherit",
          }}
        />
        {query && (
          <button
            onClick={clearSearch}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 2,
              display: "flex",
            }}
          >
            <X size={14} color="rgba(255,255,255,0.4)" />
          </button>
        )}
      </div>

      {/* ── Dropdown results ── */}
      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "rgba(22,18,40,0.98)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            maxHeight: 380,
            overflowY: "auto",
            backdropFilter: "blur(20px)",
          }}
        >
          {loading && (
            <div
              style={{
                padding: "20px 16px",
                textAlign: "center",
                fontSize: 13,
                color: "rgba(255,255,255,0.35)",
              }}
            >
              Searching...
            </div>
          )}

          {!loading && results.length === 0 && (
            <div
              style={{
                padding: "20px 16px",
                textAlign: "center",
                fontSize: 13,
                color: "rgba(255,255,255,0.35)",
              }}
            >
              No travelers found for "{query}"
            </div>
          )}

          {!loading &&
            results.map((u) => (
              <div
                key={u._id || u.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {/* Avatar — clicking navigates to profile */}
                <div
                  onClick={() => {
                    setFocused(false);
                    navigate(`/u/${u.username}`);
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    overflow: "hidden",
                    flexShrink: 0,
                    background:
                      "linear-gradient(135deg, rgba(124,92,252,0.3), rgba(255,138,42,0.3))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {u.avatar ? (
                    <img
                      src={u.avatar}
                      alt={u.username}
                      style={{
                        width: 40,
                        height: 40,
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#fff",
                      }}
                    >
                      {(u.name || u.username || "?")[0].toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Info — clicking navigates to profile */}
                <div
                  onClick={() => {
                    setFocused(false);
                    navigate(`/u/${u.username}`);
                  }}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#fff",
                      lineHeight: 1.2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {u.name || u.username}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.4)",
                      marginTop: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>@{u.username}</span>
                    {u.city && (
                      <>
                        <span style={{ opacity: 0.3 }}>·</span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <MapPin size={10} />
                          {u.city}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Follow button */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ flexShrink: 0 }}
                >
                  <FollowButton
                    userId={u._id || u.id}
                    isFollowing={!!u.isFollowing}
                    size="small"
                    token={token}
                  />
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
