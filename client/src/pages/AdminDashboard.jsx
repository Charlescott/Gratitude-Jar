import { useEffect, useMemo, useState } from "react";
import { fetchAdminOverview, fetchAdminUsers } from "../api";

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function StatCard({ label, value }) {
  return (
    <div className="entry-card" style={{ padding: "1rem", minWidth: 180 }}>
      <div style={{ opacity: 0.8, fontSize: "0.9rem" }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, marginTop: 6 }}>
        {value}
      </div>
    </div>
  );
}

export default function AdminDashboard({ token }) {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersOffset, setUsersOffset] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const dailyRows = useMemo(() => overview?.daily || [], [overview]);

  async function loadUsers(nextOffset = 0, append = false) {
    setUsersLoading(true);
    setError("");
    try {
      const result = await fetchAdminUsers(token, { limit: 200, offset: nextOffset });
      setUsersOffset(result.offset + result.users.length);
      setUsers((prev) => (append ? [...prev, ...result.users] : result.users));
    } catch (err) {
      setError(err.message || "Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    let canceled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchAdminOverview(token);
        if (!canceled) setOverview(data);
        if (!canceled) await loadUsers(0, false);
      } catch (err) {
        if (!canceled) setError(err.message || "Failed to load admin data");
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    load();
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return (
      <div className="entries-container">
        <div className="entry-card">Loading admin dashboard…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="entries-container">
        <div className="entry-card" style={{ color: "red" }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="entries-container" style={{ maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
        <button
          className="btn btn-secondary"
          onClick={async () => {
            setLoading(true);
            try {
              const data = await fetchAdminOverview(token);
              setOverview(data);
              await loadUsers(0, false);
            } catch (err) {
              setError(err.message || "Failed to refresh");
            } finally {
              setLoading(false);
            }
          }}
        >
          Refresh
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginTop: "1rem",
        }}
      >
        <StatCard label="Total Users" value={overview?.totals?.users ?? "—"} />
        <StatCard label="Total Circles" value={overview?.totals?.circles ?? "—"} />
        <StatCard label="Total Entries" value={overview?.totals?.entries ?? "—"} />
        <StatCard label="Signed Up Today (UTC)" value={overview?.today?.users_signed_up ?? "—"} />
        <StatCard label="Signed In Today (UTC)" value={overview?.today?.users_signed_in ?? "—"} />
        <StatCard label="Entries Today (UTC)" value={overview?.today?.entries ?? "—"} />
      </div>

      <div className="entry-card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Last 14 Days (UTC)</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.85 }}>
                <th style={{ padding: "0.5rem" }}>Day</th>
                <th style={{ padding: "0.5rem" }}>Signups</th>
                <th style={{ padding: "0.5rem" }}>Logins</th>
                <th style={{ padding: "0.5rem" }}>Entries</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.map((row) => (
                <tr key={row.day} style={{ borderTop: "1px solid rgba(15, 23, 42, 0.12)" }}>
                  <td style={{ padding: "0.5rem" }}>{row.day}</td>
                  <td style={{ padding: "0.5rem" }}>{row.signups}</td>
                  <td style={{ padding: "0.5rem" }}>{row.logins}</td>
                  <td style={{ padding: "0.5rem" }}>{row.entries}</td>
                </tr>
              ))}
              {dailyRows.length === 0 && (
                <tr>
                  <td style={{ padding: "0.5rem" }} colSpan={4}>
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="entry-card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Users (Chronological)</h2>
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
                <tr key={u.id} style={{ borderTop: "1px solid rgba(15, 23, 42, 0.12)" }}>
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
            disabled={usersLoading}
            onClick={() => loadUsers(usersOffset, true)}
          >
            {usersLoading ? "Loading…" : "Load more"}
          </button>
        </div>
      </div>
    </div>
  );
}

