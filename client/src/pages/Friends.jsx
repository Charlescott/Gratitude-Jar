import { useCallback, useEffect, useState } from "react";
import Avatar from "../components/Avatar";

const API = import.meta.env.VITE_API || import.meta.env.VITE_API_URL;

export default function Friends() {
  const [tab, setTab] = useState("find");
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const token = localStorage.getItem("token");
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();
  const inviteUrl = currentUser?.id
    ? `${window.location.origin}/register?invite=${currentUser.id}`
    : window.location.origin;
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

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
      const [fRes, fwRes, reqRes, blRes] = await Promise.all([
        authFetch("/follows/following"),
        authFetch("/follows/followers"),
        authFetch("/follows/requests"),
        authFetch("/blocks"),
      ]);
      if (!fRes.ok || !fwRes.ok || !reqRes.ok || !blRes.ok) {
        throw new Error("Failed to load friends.");
      }
      const [fJson, fwJson, reqJson, blJson] = await Promise.all([
        fRes.json(),
        fwRes.json(),
        reqRes.json(),
        blRes.json(),
      ]);
      setFollowing(fJson.items || []);
      setFollowers(fwJson.items || []);
      setRequests(reqJson.items || []);
      setBlocked(blJson.items || []);
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

  async function requestFollow(userId) {
    try {
      const res = await authFetch(`/follows/${userId}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to send request");
      const data = await res.json();
      const status = data.status || "pending";
      setResults((prev) =>
        prev.map((r) =>
          r.id === userId
            ? {
                ...r,
                request_pending: status === "pending",
                is_following: status === "following",
              }
            : r
        )
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function unfollow(userId) {
    try {
      const res = await authFetch(`/follows/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to unfollow");
      setResults((prev) =>
        prev.map((r) =>
          r.id === userId
            ? { ...r, is_following: false, request_pending: false }
            : r
        )
      );
      setFollowing((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function acceptRequest(userId) {
    try {
      const res = await authFetch(`/follows/requests/${userId}/accept`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to accept");
      setRequests((prev) => prev.filter((r) => r.id !== userId));
      loadLists();
    } catch (err) {
      setError(err.message);
    }
  }

  async function denyRequest(userId) {
    try {
      const res = await authFetch(`/follows/requests/${userId}/deny`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to deny");
      setRequests((prev) => prev.filter((r) => r.id !== userId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function blockUser(userId) {
    if (!window.confirm("Block this user? They won't see your posts and you won't see theirs.")) return;
    try {
      const res = await authFetch(`/blocks/${userId}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to block");
      // Block clears follows + requests in both directions.
      setFollowing((prev) => prev.filter((u) => u.id !== userId));
      setFollowers((prev) => prev.filter((u) => u.id !== userId));
      setRequests((prev) => prev.filter((u) => u.id !== userId));
      setResults((prev) => prev.filter((u) => u.id !== userId));
      loadLists();
    } catch (err) {
      setError(err.message);
    }
  }

  async function sendInvite(e) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviteSending(true);
    setInviteError("");
    setInviteMessage("");
    try {
      const res = await authFetch("/follows/invite", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invite failed");
      if (data.status === "user_exists") {
        // Existing user — auto-send a follow request and tell them.
        await authFetch(`/follows/${data.user_id}`, { method: "POST" });
        setInviteMessage(
          `${email} is already on Gratitude Jar — sent them a follow request.`
        );
      } else {
        setInviteMessage(`Invite sent to ${email}.`);
      }
      setInviteEmail("");
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setInviteSending(false);
    }
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setInviteError("Couldn't copy — copy the link manually.");
    }
  }

  async function unblockUser(userId) {
    try {
      const res = await authFetch(`/blocks/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to unblock");
      setBlocked((prev) => prev.filter((u) => u.id !== userId));
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
        padding: "0.55rem 0.4rem",
        fontSize: "0.85rem",
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
          gap: "0.4rem",
          margin: "0 0 1rem 0",
          flexWrap: "wrap",
        }}
      >
        {tabBtn("find", "Find")}
        {tabBtn("invite", "Invite")}
        {tabBtn(
          "requests",
          requests.length > 0 ? `Requests (${requests.length})` : "Requests"
        )}
        {tabBtn("following", `Following (${following.length})`)}
        {tabBtn("followers", `Followers (${followers.length})`)}
        {tabBtn(
          "blocked",
          blocked.length > 0 ? `Blocked (${blocked.length})` : "Blocked"
        )}
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
              <UserRow key={u.id} user={u}>
                {u.is_following ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => unfollow(u.id)}
                  >
                    Following
                  </button>
                ) : u.request_pending ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => unfollow(u.id)}
                    title="Cancel request"
                  >
                    Requested
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => requestFollow(u.id)}
                  >
                    Follow
                  </button>
                )}
                <BlockButton onClick={() => blockUser(u.id)} />
              </UserRow>
            ))}
          </ul>
        </div>
      )}

      {tab === "invite" && (
        <div className="entry-card">
          <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1.05rem" }}>
            Invite a friend
          </h2>
          <p style={{ marginTop: 0, color: "var(--muted-text)", fontSize: "0.9rem" }}>
            Send an email invite or share your personal link.
          </p>
          <form
            onSubmit={sendInvite}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              maxWidth: 420,
              marginBottom: "1rem",
            }}
          >
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="friend@example.com"
              required
            />
            <button
              type="submit"
              className="btn btn-secondary"
              disabled={inviteSending || !inviteEmail.trim()}
              style={{ alignSelf: "flex-start" }}
            >
              {inviteSending ? "Sending…" : "Send invite"}
            </button>
            {inviteMessage && (
              <p style={{ margin: 0, color: "#059669" }}>{inviteMessage}</p>
            )}
            {inviteError && (
              <p style={{ margin: 0, color: "#dc2626" }}>{inviteError}</p>
            )}
          </form>

          <div
            style={{
              borderTop: "1px solid rgba(15, 23, 42, 0.08)",
              paddingTop: "1rem",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem" }}>
              Share your invite link
            </h3>
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <code
                style={{
                  flex: 1,
                  minWidth: 200,
                  background: "rgba(15, 23, 42, 0.06)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: 8,
                  fontSize: "0.85rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {inviteUrl}
              </code>
              <button
                type="button"
                className="btn"
                onClick={copyInviteLink}
                style={{ flexShrink: 0 }}
              >
                {linkCopied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "requests" && (
        <div className="entry-card">
          {loading ? (
            <p>Loading…</p>
          ) : requests.length === 0 ? (
            <p>No pending follow requests.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {requests.map((u) => (
                <UserRow key={u.id} user={u}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => acceptRequest(u.id)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => denyRequest(u.id)}
                  >
                    Deny
                  </button>
                </UserRow>
              ))}
            </ul>
          )}
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
                <UserRow key={u.id} user={u}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => unfollow(u.id)}
                  >
                    Unfollow
                  </button>
                  <BlockButton onClick={() => blockUser(u.id)} />
                </UserRow>
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
                  <UserRow key={u.id} user={u}>
                    {iFollow ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => unfollow(u.id)}
                      >
                        Following
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => requestFollow(u.id)}
                      >
                        Follow back
                      </button>
                    )}
                    <BlockButton onClick={() => blockUser(u.id)} />
                  </UserRow>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === "blocked" && (
        <div className="entry-card">
          {loading ? (
            <p>Loading…</p>
          ) : blocked.length === 0 ? (
            <p>You haven't blocked anyone.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {blocked.map((u) => (
                <UserRow key={u.id} user={u}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => unblockUser(u.id)}
                  >
                    Unblock
                  </button>
                </UserRow>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function UserRow({ user, children }) {
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
          flex: 1,
        }}
      >
        <Avatar
          src={user.avatar_url}
          name={user.name || user.email}
          size={36}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user.name || user.email}
          </div>
          {user.name && (
            <div
              style={{
                fontSize: "0.85rem",
                color: "var(--muted-text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.email}
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: "0.4rem",
          flexShrink: 0,
          alignItems: "center",
        }}
      >
        {children}
      </div>
    </li>
  );
}

function BlockButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Block user"
      aria-label="Block user"
      style={{
        background: "transparent",
        border: "1px solid rgba(220, 38, 38, 0.35)",
        color: "#dc2626",
        borderRadius: 999,
        width: 32,
        height: 32,
        fontSize: "0.85rem",
        fontWeight: 700,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
    >
      ⊘
    </button>
  );
}
