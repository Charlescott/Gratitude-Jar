import { useEffect, useState } from "react";
import ReminderForm from "../components/ReminderForm";

export default function RemindersPage() {
  const API = import.meta.env.VITE_API || import.meta.env.VITE_API_URL;
  const [reminder, setReminder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      </div>
    </div>
  );
}
