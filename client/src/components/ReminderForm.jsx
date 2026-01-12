import { useState, useEffect } from "react";

export default function ReminderForm({ reminder, onSave }) {
  const [time, setTime] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [active, setActive] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Populate form when parent reminder changes
  useEffect(() => {
    if (!reminder) return;
    setTime(reminder.time_of_day);
    setFrequency(reminder.frequency);
    setActive(reminder.active);
  }, [reminder]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!time) {
      setError("Please select a time for your reminder.");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        "https://gratuity-jar-api.onrender.com/reminders",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            time_of_day: time,
            frequency,
            active,
            timezone: userTimezone,
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to save reminder");

      const updated = await res.json();
      onSave(updated); // update parent summary
      setSuccess("Reminder updated!");
    } catch (err) {
      console.error(err);
      setError("Failed to save reminder.");
    }
  };

  return (
    <div className="entry-card">
      <h2>Set a Reminder</h2>
      <form className="reminder-form" onSubmit={handleSubmit}>
        <label>
          Time of day:
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="reminder-input"
            required
          />
        </label>

        <div className="reminder-row">
          <div>
            <label>
              Frequency:
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="reminder-input"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Enable reminders
          </label>
        </div>

        <button className="btn btn-secondary" type="submit">
          Set Reminder
        </button>

        {success && (
          <p className="reminder-status" style={{ color: "green" }}>
            {success}
          </p>
        )}
        {error && (
          <p className="reminder-status" style={{ color: "red" }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
