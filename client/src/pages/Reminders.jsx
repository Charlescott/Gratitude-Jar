import { useEffect, useState } from "react";
import ReminderForm from "../components/ReminderForm";

export default function RemindersPage() {
  const [reminder, setReminder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchReminder() {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:5000/reminders", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to fetch reminder");

        const data = await res.json();
        setReminder(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load reminder.");
      } finally {
        setLoading(false);
      }
    }

    fetchReminder();
  }, []);

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
