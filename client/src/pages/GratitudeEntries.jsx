import { useEffect, useState } from "react";
import { getRandomQuestion } from "../api/questions";

export default function GratitudeEntries({ token }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [prompt, setPrompt] = useState(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const MOOD_MAP = {
    happy: "😊",
    calm: "😌",
    neutral: "😐",
    low: "😔",
    stressed: "😤",
    grateful: "🙏",
  };

  async function handleHelpMeOut() {
    setLoadingPrompt(true);
    try {
      const question = await getRandomQuestion();
      setPrompt(question.text);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPrompt(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!token) return;

    try {
      const res = await fetch("http://localhost:5000/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, mood }),
      });

      if (!res.ok) throw new Error("Failed to add entry");

      const newEntry = await res.json();
      setEntries((prev) => [{ ...newEntry, show: false }, ...prev]);
      setContent("");
      setMood("");

      // trigger animation in next tick
      setTimeout(() => {
        setEntries((prev) =>
          prev.map((entry) =>
            entry.id === newEntry.id ? { ...entry, show: true } : entry
          )
        );
      }, 50);
    } catch (err) {
      setError(err.message);
    }
  }

  // handle Delete
  async function handleDelete(id) {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5000/entries/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to delete entry");

      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  // Fetch entries from backend
  useEffect(() => {
    async function fetchEntries() {
      try {
        const res = await fetch("http://localhost:5000/entries", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error("Failed to fetch entries");
        const data = await res.json();
        setEntries(data.map((entry) => ({ ...entry, show: true })));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchEntries();
  }, [token]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="entries-container">
      <h1 className="entries-header">Gratuity Jar</h1>

      {/* Form section */}
      <div className="entry-card">
        <h2>Add a Gratitude Entry</h2>
        <form onSubmit={handleSubmit}>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={content ? "" : prompt || "Write something..."}
            required
          />

          <button type="button" className="btn-help" onClick={handleHelpMeOut}>
            {loadingPrompt ? "Thinking…" : "Help me out"}
          </button>
          <select
            className="input"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
          >
            <option value="">Mood (optional)</option>
            <option value="happy">😊 Happy</option>
            <option value="calm">😌 Calm</option>
            <option value="neutral">😐 Neutral</option>
            <option value="low">😔 Low</option>
            <option value="stressed">😤 Stressed</option>
            <option value="grateful">🙏 Grateful</option>
          </select>
          <button
            className="btn btn-secondary"
            type="submit"
            disabled={!content.trim()}
          >
            Add Entry
          </button>
        </form>
      </div>

      {/* Entries list section */}
      <div>
        <h2>Your Entries</h2>
        {entries.length === 0 ? (
          <p>No entries yet. Add one!</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={`entry-item ${entry.show ? "show" : ""}`}
              >
                <div className="entry-item-content">
                  <strong>
                    {new Date(entry.created_at).toLocaleDateString()}:
                  </strong>{" "}
                  {entry.content}
                  {entry.mood && (
                    <span className="entry-mood">
                      {MOOD_MAP[entry.mood] ?? "🙂"}
                    </span>
                  )}
                </div>
                <button
                  className="delete-btn"
                  onClick={() => handleDelete(entry.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
