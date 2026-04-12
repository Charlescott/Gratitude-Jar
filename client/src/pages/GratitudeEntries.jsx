import { useEffect, useState } from "react";
import { getRandomQuestion } from "../api/questions";

export default function GratitudeEntries({ token }) {
  const API = import.meta.env.VITE_API || import.meta.env.VITE_API_URL;
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState(null);
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [prompt, setPrompt] = useState(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [sharePlatforms, setSharePlatforms] = useState([]);
  const PAGE_SIZE = 50;

  const MOOD_MAP = {
    happy: "😊",
    calm: "😌",
    neutral: "😐",
    low: "😔",
    stressed: "😤",
    grateful: "🙏",
  };

  // Fetch random prompt
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

  // Add new entry
  async function handleSubmit(e) {
    e.preventDefault();
    if (!token || !API) {
      setError("API URL is not configured.");
      return;
    }

    try {
      const entryText = content.trim();
      const res = await fetch(`${API}/entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: entryText, mood }),
      });
      if (!res.ok) throw new Error("Failed to add entry");

      const newEntry = await res.json();
      setEntries((prev) => [{ ...newEntry, show: false }, ...prev]);
      setOffset((prev) => prev + 1);
      setContent("");
      setMood("");

      sharePlatforms.forEach((platform) => {
        let url;
        const shareText = `${entryText} Shared via The Gratitude Jar`;
        const shareUrl = window.location.origin;
        if (platform === "twitter") {
          url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
            shareText
          )}&url=${encodeURIComponent(shareUrl)}`;
        } else if (platform === "facebook") {
          url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
            shareUrl
          )}&quote=${encodeURIComponent(shareText)}`;
        }
        if (url) {
          window.open(url, "_blank", "width=600,height=400");
        }
      });

      setSharePlatforms([]);

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

  // Delete entry
  async function handleDelete(id) {
    if (!API) {
      setError("API URL is not configured.");
      return;
    }

    try {
      const res = await fetch(`${API}/entries/${id}`, {
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

  // Fetch entries
  useEffect(() => {
    if (!token || !API) {
      setEntries([]);
      setLoading(false);
      setHasMore(false);
      setOffset(0);
      return;
    }

    let isActive = true;
    setLoading(true);
    setError(null);
    setEntries([]);
    setHasMore(false);
    setOffset(0);

    async function fetchEntries() {
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: "0",
        });

        const res = await fetch(`${API}/entries?${params.toString()}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch entries");
        const payload = await res.json();
        if (!isActive) return;
        const items = Array.isArray(payload) ? payload : payload.items || [];
        const limit = Number.isFinite(payload?.limit) ? payload.limit : items.length;
        setEntries(items.map((entry) => ({ ...entry, show: true })));
        setHasMore(Boolean(payload?.hasMore));
        setOffset(limit);
      } catch (err) {
        if (!isActive) return;
        setError(err.message);
      } finally {
        if (!isActive) return;
        setLoading(false);
      }
    }
    fetchEntries();

    return () => {
      isActive = false;
    };
  }, [API, token]);

  async function handleLoadMore() {
    if (!token || !API || loadingMore || loading || !hasMore) return;

    setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const res = await fetch(`${API}/entries?${params.toString()}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch more entries");
      const payload = await res.json();
      const items = Array.isArray(payload) ? payload : payload.items || [];
      const limit = Number.isFinite(payload?.limit) ? payload.limit : items.length;

      setEntries((prev) => [
        ...prev,
        ...items.map((entry) => ({ ...entry, show: true })),
      ]);
      setHasMore(Boolean(payload?.hasMore));
      setOffset((prev) => prev + limit);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div className="entries-container">
      <h1 className="entries-header">Gratitude Jar</h1>

      {/* Form */}
      <div className="entry-card">
        <h2>Add a Gratitude Entry</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={prompt || "Write something..."}
            required
            style={{ resize: "none" }}
          />

          <div className="form-row">
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
              type="button"
              className="btn-help"
              onClick={handleHelpMeOut}
            >
              {loadingPrompt ? "Thinking…" : "Help me out"}
            </button>
          </div>

          <div className="share-options">
            <label>Share on social media:</label>
            <label className="share-checkbox">
              <input
                type="checkbox"
                checked={sharePlatforms.includes("twitter")}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSharePlatforms((prev) => [...prev, "twitter"]);
                  } else {
                    setSharePlatforms((prev) => prev.filter((p) => p !== "twitter"));
                  }
                }}
              />
              Twitter
            </label>
            <label className="share-checkbox">
              <input
                type="checkbox"
                checked={sharePlatforms.includes("facebook")}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSharePlatforms((prev) => [...prev, "facebook"]);
                  } else {
                    setSharePlatforms((prev) => prev.filter((p) => p !== "facebook"));
                  }
                }}
              />
              Facebook
            </label>
          </div>

          <button
            className="btn btn-secondary"
            type="submit"
            disabled={!content.trim()}
          >
            Add Entry
          </button>
        </form>
      </div>

      {/* Entries List */}
      <div>
        <h2>Your Entries</h2>
        {entries.length === 0 ? (
          <p>No entries yet. Add one!</p>
        ) : (
          <>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className={`entry-item ${entry.show ? "show" : ""}`}
                >
                  <div className="entry-item-content">
                    <strong>{new Date(entry.created_at).toLocaleDateString()}:</strong>{" "}
                    {entry.content}
                    {entry.mood && (
                      <span className="entry-mood">{MOOD_MAP[entry.mood]}</span>
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

            {hasMore && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{ marginTop: "1rem" }}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
