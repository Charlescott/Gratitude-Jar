import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReminderForm from "../components/ReminderForm";

export default function RemindersPage() {
  const navigate = useNavigate();
  const API = import.meta.env.VITE_API || import.meta.env.VITE_API_URL;
  const [reminder, setReminder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !API) {
      setReminder(null);
      setLoading(false);
      setError(!API ? "API URL is not configured." : "");
      return;
    }

    let isActive = true;
    setLoading(true);
    setError("");
    setReminder(null);

    async function fetchReminder() {
      try {
        const res = await fetch(`${API}/reminders`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to fetch reminder");

        const data = await res.json();
        if (!isActive) return;
        setReminder(data);
      } catch (err) {
        if (!isActive) return;
        console.error(err);
        setError("Failed to load reminder.");
      } finally {
        if (!isActive) return;
        setLoading(false);
      }
    }

    fetchReminder();

    return () => {
      isActive = false;
    };
  }, [API]);

  if (loading) return <p>Loading reminders...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  async function handleDeleteAccount(e) {
    e.preventDefault();
    const token = localStorage.getItem("token");

    if (!token || !API) {
      setDeleteError(!API ? "API URL is not configured." : "Not logged in.");
      return;
    }

    setDeleteError("");
    setDeleteLoading(true);

    try {
      const res = await fetch(`${API}/auth/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          password: deletePassword,
          confirmation: deleteConfirmation,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete account");
      }

      localStorage.removeItem("token");
      navigate("/", { replace: true });
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="reminders-page">
      <h1 className="entries-header">Set Your Gratitude Reminders</h1>

      <div className="reminders-container">
        {reminder ? (
          <div className="reminder-summary">
            <p>
              <strong>Current reminder:</strong> {reminder.frequency} at{" "}
              {new Date(`1970-01-01T${reminder.time_of_day}`).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p>Status: {reminder.active ? "Active" : "Paused"}</p>
          </div>
        ) : (
          <p>No reminder set yet.</p>
        )}

        <p style={{ marginBottom: "1rem", color: "var(--muted-text)" }}>
          Choose when and how often you want to be prompted to fill out your gratitude notes.
        </p>

        <ReminderForm reminder={reminder} onSave={setReminder} />

        <details style={{ marginTop: "1.25rem" }}>
          <summary
            style={{
              cursor: "pointer",
              color: "var(--muted-text)",
              userSelect: "none",
            }}
          >
            Account
          </summary>

          <div
            style={{
              marginTop: "0.85rem",
              padding: "1rem",
              borderRadius: "14px",
              border: "1px solid rgba(220, 38, 38, 0.25)",
              background: "rgba(220, 38, 38, 0.06)",
            }}
          >
            <h3 style={{ margin: 0, color: "#dc2626" }}>Delete account</h3>
            <p style={{ margin: "0.5rem 0 0.85rem", color: "var(--muted-text)" }}>
              This permanently deletes your account and all of your data. This
              can’t be undone.
            </p>

            <form
              onSubmit={handleDeleteAccount}
              style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}
            >
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                className="input"
              />

              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder='Type "DELETE" to confirm'
                required
                className="input"
              />

              {deleteError && (
                <p style={{ margin: 0, color: "#dc2626" }}>{deleteError}</p>
              )}

              <button
                type="submit"
                className="btn btn-secondary"
                disabled={deleteLoading}
                style={{
                  borderColor: "rgba(220, 38, 38, 0.55)",
                  color: "#dc2626",
                  background: "transparent",
                }}
              >
                {deleteLoading ? "Deleting..." : "Delete my account"}
              </button>
            </form>
          </div>
        </details>
      </div>
    </div>
  );
}
