import { useEffect, useState } from "react";

export default function GratitudeEntries() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState("");
  const [moodTag, setMoodTag] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      const res = await fetch("http://localhost:5000/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, mood_tag: moodTag }),
      });

      if (!res.ok) throw new Error("Failed to add entry");

      const newEntry = await res.json();
      setEntries((prev) => [newEntry, ...entries]);
      setContent("");
      setMoodTag("");
    } catch (err) {
      setError(err.message);
    }
  }

  // Fetch entries from backend
  useEffect(() => {
    async function fetchEntries() {
      try {
        const res = await fetch("http://localhost:5000/entries");
        if (!res.ok) throw new Error("Failed to fetch entries");
        const data = await res.json();
        setEntries(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchEntries();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <h1>Gratuity Jar</h1>

      {/* Form section */}
      <div style={{ marginBottom: "2rem" }}>
        <h2>Add a Gratitude Entry</h2>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="content">What are you grateful for?</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="moodTag">Mood (optional)</label>
            <input
              id="moodTag"
              type="text"
              value={moodTag}
              onChange={(e) => setMoodTag(e.target.value)}
            />
          </div>

          <button type="submit">Add Entry</button>
        </form>
      </div>

      {/* Entries list section */}
      <div>
        <h2>Your Entries</h2>
        {entries.length === 0 ? (
          <p>No entries yet. Add one!</p>
        ) : (
          <ul>
            {entries.map((entry) => (
              <li key={entry.id} style={{ marginBottom: "1rem" }}>
                <strong>
                  {new Date(entry.created_at).toLocaleDateString()}:
                </strong>{" "}
                {entry.content} {entry.mood_tag && `(${entry.mood_tag})`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
