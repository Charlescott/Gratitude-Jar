import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API || import.meta.env.VITE_API_URL;
const POLL_MS = 30000;

export default function NotificationBell({ token }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 480 : false
  );
  const panelRef = useRef(null);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 480);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const authFetch = useCallback(
    (path, options = {}) =>
      fetch(`${API}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      }),
    [token]
  );

  const fetchUnreadCount = useCallback(async () => {
    if (!API || !token) return;
    try {
      const res = await authFetch("/notifications/unread-count");
      if (!res.ok) return;
      const json = await res.json();
      setUnreadCount(json.unread_count || 0);
    } catch {
      // swallow; next poll will retry
    }
  }, [authFetch, token]);

  const fetchList = useCallback(async () => {
    if (!API || !token) return;
    setLoading(true);
    try {
      const res = await authFetch("/notifications?limit=20");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setItems(json.items || []);
      setUnreadCount(json.unread_count || 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authFetch, token]);

  useEffect(() => {
    if (!token) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    fetchUnreadCount();
    const handle = setInterval(fetchUnreadCount, POLL_MS);
    return () => clearInterval(handle);
  }, [token, fetchUnreadCount]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function togglePanel() {
    const next = !open;
    setOpen(next);
    if (next) fetchList();
  }

  async function handleItemClick(item) {
    if (!item.read_at) {
      try {
        await authFetch(`/notifications/${item.id}/read`, { method: "POST" });
      } catch {
        // still navigate
      }
      setItems((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setOpen(false);
    if (item.link) navigate(item.link);
  }

  async function markAllRead() {
    try {
      await authFetch("/notifications/read-all", { method: "POST" });
    } catch {
      return;
    }
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: now }))
    );
    setUnreadCount(0);
  }

  if (!token) return null;

  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={togglePanel}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        className="icon-btn"
        style={{ position: "relative", fontSize: "1.15rem", lineHeight: 1 }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "#dc2626",
              color: "#fff",
              fontSize: "0.7rem",
              fontWeight: 700,
              borderRadius: 999,
              minWidth: 18,
              height: 18,
              padding: "0 4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {badgeLabel}
          </span>
        )}
      </button>

      <div
        style={{
          position: isMobile ? "fixed" : "absolute",
          top: isMobile ? "3.5rem" : undefined,
          right: isMobile ? "0.5rem" : 0,
          left: isMobile ? "0.5rem" : undefined,
          marginTop: isMobile ? 0 : "0.5rem",
          background: "var(--bg-color)",
          border: "1px solid rgba(15, 23, 42, 0.12)",
          backdropFilter: "blur(10px)",
          borderRadius: "12px",
          padding: "0.5rem 0",
          boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
          color: "var(--text-color)",
          display: "flex",
          flexDirection: "column",
          width: isMobile ? "auto" : "320px",
          maxWidth: isMobile ? undefined : "90vw",
          zIndex: 20,
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(-15px)",
          pointerEvents: open ? "auto" : "none",
          transition:
            "opacity 0.25s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.25rem 1rem 0.5rem",
            borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
          }}
        >
          <strong>Notifications</strong>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              style={{
                background: "transparent",
                border: "none",
                color: "#2563eb",
                cursor: "pointer",
                fontSize: "0.85rem",
                padding: 0,
              }}
            >
              Mark all read
            </button>
          )}
        </div>

        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {loading && items.length === 0 ? (
            <p style={{ padding: "0.75rem 1rem" }}>Loading…</p>
          ) : items.length === 0 ? (
            <p
              style={{
                padding: "0.75rem 1rem",
                color: "var(--muted-text)",
                margin: 0,
              }}
            >
              No notifications yet.
            </p>
          ) : (
            items.map((n) => (
              <button
                type="button"
                key={n.id}
                onClick={() => handleItemClick(n)}
                style={{
                  textAlign: "left",
                  background: n.read_at ? "transparent" : "rgba(37, 99, 235, 0.08)",
                  border: "none",
                  borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                  padding: "0.65rem 1rem",
                  cursor: "pointer",
                  color: "inherit",
                  font: "inherit",
                  width: "100%",
                  minWidth: 0,
                  boxSizing: "border-box",
                  display: "block",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    fontWeight: n.read_at ? 400 : 600,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    wordBreak: "break-word",
                  }}
                >
                  {n.title}
                </div>
                {n.body && (
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--muted-text)",
                      marginTop: "0.15rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "100%",
                    }}
                  >
                    {n.body}
                  </div>
                )}
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--muted-text)",
                    marginTop: "0.25rem",
                  }}
                >
                  {formatTime(n.created_at)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(iso) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
