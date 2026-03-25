import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAdminCircles } from "../../api";

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export default function AdminCircles({ token }) {
  const [circles, setCircles] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  async function load({ nextOffset = 0, append = false } = {}) {
    if (append) setLoadingMore(true);
    else setLoading(true);

    setError("");
    try {
      const result = await fetchAdminCircles(token, { limit: 100, offset: nextOffset });
      setOffset(result.offset + result.circles.length);
      setCircles((prev) => (append ? [...prev, ...result.circles] : result.circles));
    } catch (err) {
      setError(err.message || "Failed to load circles");
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    load({ nextOffset: 0, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="entries-container" style={{ maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Circles</h1>
        <Link to="/admin" style={{ fontSize: "0.95rem" }}>
          Back to dashboard
        </Link>
      </div>

      <div className="entry-card" style={{ marginTop: "1rem" }}>
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
          Loading circles…
        </div>
      ) : error ? (
        <div className="entry-card" style={{ marginTop: "1rem", color: "red" }}>
          {error}
        </div>
      ) : (
        <>
          {circles.map((c) => (
            <div key={c.id} className="entry-card" style={{ marginTop: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{c.name}</div>
                  <div style={{ opacity: 0.85, fontSize: "0.9rem", marginTop: 4 }}>
                    Created: {formatDateTime(c.created_at)} • Members: {c.member_count}
                  </div>
                  <div style={{ opacity: 0.85, fontSize: "0.9rem", marginTop: 4 }}>
                    Owner: {c.owner?.email || "—"}
                  </div>
                </div>
                <div style={{ opacity: 0.75, fontSize: "0.85rem" }}>Key: {c.key}</div>
              </div>

              <details style={{ marginTop: "0.75rem" }}>
                <summary style={{ cursor: "pointer" }}>Members</summary>
                <div style={{ marginTop: "0.5rem", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", opacity: 0.85 }}>
                        <th style={{ padding: "0.5rem" }}>Joined</th>
                        <th style={{ padding: "0.5rem" }}>Email</th>
                        <th style={{ padding: "0.5rem" }}>Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(c.members || []).map((m) => (
                        <tr
                          key={m.id}
                          style={{ borderTop: "1px solid rgba(15, 23, 42, 0.12)" }}
                        >
                          <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                            {formatDateTime(m.joined_at)}
                          </td>
                          <td style={{ padding: "0.5rem" }}>{m.email}</td>
                          <td style={{ padding: "0.5rem" }}>{m.name || "—"}</td>
                        </tr>
                      ))}
                      {(c.members || []).length === 0 && (
                        <tr>
                          <td style={{ padding: "0.5rem" }} colSpan={3}>
                            No members
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          ))}

          {circles.length === 0 && (
            <div className="entry-card" style={{ marginTop: "1rem" }}>
              No circles
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: "1rem" }}>
            <button
              className="btn btn-secondary"
              disabled={loadingMore}
              onClick={() => load({ nextOffset: offset, append: true })}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

