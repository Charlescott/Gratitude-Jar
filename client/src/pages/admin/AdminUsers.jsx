import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAdminUsers } from "../../api";

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export default function AdminUsers({ token }) {
  const [users, setUsers] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [orderBy, setOrderBy] = useState("created_at");
  const [direction, setDirection] = useState("desc");

  const orderLabel = useMemo(() => {
    if (orderBy === "last_login_at") return "Last login";
    return "Date created";
  }, [orderBy]);

  async function load({ nextOffset = 0, append = false } = {}) {
    if (append) setLoadingMore(true);
    else setLoading(true);

    setError("");
    try {
      const result = await fetchAdminUsers(token, {
        limit: 200,
        offset: nextOffset,
        orderBy,
        direction,
      });
      setOffset(result.offset + result.users.length);
      setUsers((prev) => (append ? [...prev, ...result.users] : result.users));
    } catch (err) {
      setError(err.message || "Failed to load users");
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    load({ nextOffset: 0, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, orderBy, direction]);

  return (
    <div className="entries-container" style={{ maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Users</h1>
        <Link to="/admin" style={{ fontSize: "0.95rem" }}>
          Back to dashboard
        </Link>
      </div>

      <div
        className="entry-card"
        style={{
          marginTop: "1rem",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ opacity: 0.85 }}>Order:</div>
        <select
          value={orderBy}
          onChange={(e) => setOrderBy(e.target.value)}
          style={{ padding: "0.5rem", borderRadius: 10 }}
        >
          <option value="created_at">Date created</option>
          <option value="last_login_at">Last login</option>
        </select>

        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          style={{ padding: "0.5rem", borderRadius: 10 }}
        >
          <option value="desc">{orderLabel}: newest first</option>
          <option value="asc">{orderLabel}: oldest first</option>
        </select>

        <button
          className="btn btn-secondary"
          onClick={() => load({ nextOffset: 0, append: false })}
          disabled={loading || loadingMore}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="entry-card" style={{ marginTop: "1rem" }}>
          Loading users…
        </div>
      ) : error ? (
        <div className="entry-card" style={{ marginTop: "1rem", color: "red" }}>
          {error}
        </div>
      ) : (
        <div className="entry-card" style={{ marginTop: "1rem" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", opacity: 0.85 }}>
                  <th style={{ padding: "0.5rem" }}>Created</th>
                  <th style={{ padding: "0.5rem" }}>Email</th>
                  <th style={{ padding: "0.5rem" }}>Name</th>
                  <th style={{ padding: "0.5rem" }}>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    style={{ borderTop: "1px solid rgba(15, 23, 42, 0.12)" }}
                  >
                    <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                      {formatDateTime(u.created_at)}
                    </td>
                    <td style={{ padding: "0.5rem" }}>{u.email}</td>
                    <td style={{ padding: "0.5rem" }}>{u.name || "—"}</td>
                    <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                      {formatDateTime(u.last_login_at)}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td style={{ padding: "0.5rem" }} colSpan={4}>
                      No users
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: "0.75rem" }}>
            <button
              className="btn btn-secondary"
              disabled={loadingMore}
              onClick={() => load({ nextOffset: offset, append: true })}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

