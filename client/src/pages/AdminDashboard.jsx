import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAdminOverview } from "../api";

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

function StatLinkCard({ label, value, to }) {
  return (
    <Link
      to={to}
      className="entry-card"
      style={{
        padding: "1rem",
        minWidth: 180,
        textDecoration: "none",
        color: "inherit",
        display: "block",
        border: "1px solid rgba(15, 23, 42, 0.12)",
      }}
    >
      <div style={{ opacity: 0.8, fontSize: "0.9rem" }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, marginTop: 6 }}>
        {value}
      </div>
      <div style={{ marginTop: 8, opacity: 0.8, fontSize: "0.9rem" }}>
        View →
      </div>
    </Link>
  );
}

export default function AdminDashboard({ token }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const dailyRows = useMemo(() => overview?.daily || [], [overview]);

  useEffect(() => {
    let canceled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchAdminOverview(token);
        if (!canceled) setOverview(data);
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
        <StatLinkCard
          label="Total Users"
          value={overview?.totals?.users ?? "—"}
          to="/admin/users"
        />
        <StatLinkCard
          label="Total Circles"
          value={overview?.totals?.circles ?? "—"}
          to="/admin/circles"
        />
        <StatCard label="Total Entries" value={overview?.totals?.entries ?? "—"} />
        <StatCard label="Signed Up Today" value={overview?.today?.users_signed_up ?? "—"} />
        <StatCard label="Signed In Today" value={overview?.today?.users_signed_in ?? "—"} />
        <StatCard label="Entries Today" value={overview?.today?.entries ?? "—"} />
      </div>

      <div className="entry-card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Last 14 Days</h2>
        <div style={{ opacity: 0.75, fontSize: "0.9rem", marginTop: "-0.25rem" }}>
          Daily boundaries are calculated in UTC.
        </div>
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
    </div>
  );
}
