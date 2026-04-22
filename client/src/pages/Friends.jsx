import { useCallback, useEffect, useState } from "react";
import Avatar from "../components/Avatar";

const API = import.meta.env.VITE_API || import.meta.env.VITE_API_URL;

export default function Friends() {
  const [tab, setTab] = useState("find");
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const token = localStorage.getItem("token");

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

  const loadLists = useCallback(async () => {
    if (!API || !token) {
      setLoading(false);
      setError(!API ? "API URL is not configured." : "Not logged in.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [fRes, fwRes] = await Promise.all([
        authFetch("/follows/following"),
        authFetch("/follows/followers"),
      ]);
      if (!fRes.ok || !fwRes.ok) throw new Error("Failed to load friends.");
      const fJson = await fRes.json();
      const fwJson = await fwRes.json();
      setFollowing(fJson.items || []);
      setFollowers(fwJson.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, token]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let canceled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await authFetch(
          `/follows/search?q=${encodeURIComponent(q)}`
        );
        if (!res.ok) throw new Error("Search failed");
        const json = await res.json();
        if (!canceled) setResults(json.items || []);
      } catch (err) {
        if (!canceled) setError(err.message);
      } finally {
        if (!canceled) setSearching(false);
      }
    }, 300);
    return () => {
      canceled = true;
      clearTimeout(handle);
    };
  }, [query, authFetch]);

  async function follow(userId) {
    try {
      const res = await authFetch(`/follows/${userId}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to follow");
      setResults((prev) =>
        prev.map((r) => (r.id === userId ? { ...r, is_following: true } : r))
      );
      loadLists();
    } catch (err) {
      setError(err.message);
    }
  }

  async function unfollow(userId) {
    try {
      const res = await authFetch(`/follows/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to unfollow");
      setResults((prev) =>
        prev.map((r) => (r.id === userId ? { ...r, is_following: false } : r))
      );
      setFollowing((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      setError(err.message);
    }
  }

  const tabBtn = (id, label) => (
    <button
      key={id}
      type="button"
      className={`btn ${tab === id ? "btn-secondary" : ""}`}
      onClick={() => setTab(id)}
      style={{
        flex: "1 1 0",
        minWidth: 0,
        padding: "0.55rem 0.5rem",
        fontSize: "0.9rem",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="entries-container">
      <h1 className="entries-header">Friends</h1>

      {error && (
        <p style={{ color: "red" }} role="alert">
          {error}
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          margin: "0 0 1rem 0",
        }}
      >
        {tabBtn("find", "Find people")}
        {tabBtn("following", `Following (${following.length})`)}
        {tabBtn("followers", `Followers (${followers.length})`)}
      </div>

      {tab === "find" && (
        <div className="entry-card">
          <input
            type="text"
            className="input"
            placeholder="Search by name or email (min 2 chars)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
          {searching && <p>Searching…</p>}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p>No users found.</p>
          )}
          <ul style={{ listStyle: "none", padding: 0, marginTop: "1rem" }}>
            {results.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isFollowing={Boolean(u.is_following)}
                onFollow={() => follow(u.id)}
                onUnfollow={() => unfollow(u.id)}
              />
            ))}
          </ul>
        </div>
      )}

      {tab === "following" && (
        <div className="entry-card">
          {loading ? (
            <p>Loading…</p>
          ) : following.length === 0 ? (
            <p>You are not following anyone yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {following.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isFollowing
                  onUnfollow={() => unfollow(u.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "followers" && (
        <div className="entry-card">
          {loading ? (
            <p>Loading…</p>
          ) : followers.length === 0 ? (
            <p>No followers yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {followers.map((u) => {
                const iFollow = following.some((f) => f.id === u.id);
                return (
                  <UserRow
                    key={u.id}
                    user={u}
                    isFollowing={iFollow}
                    onFollow={() => follow(u.id)}
                    onUnfollow={() => unfollow(u.id)}
                  />
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function UserRow({ user, isFollowing, onFollow, onUnfollow }) {
  return (
    <li
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.65rem 0.25rem",
        borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          minWidth: 0,
        }}
      >
        <Avatar
          src={user.avatar_url}
          name={user.name || user.email}
          size={36}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>
            {user.name || user.email}
          </div>
          {user.name && (
            <div
              style={{
                fontSize: "0.85rem",
                color: "var(--muted-text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user.email}
            </div>
          )}
        </div>
      </div>
      {isFollowing ? (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onUnfollow}
        >
          Unfollow
        </button>
      ) : (
        <button type="button" className="btn" onClick={onFollow}>
          Follow
        </button>
      )}
    </li>
  );
}
