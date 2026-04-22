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
  const [visibility, setVisibility] = useState("private");
  const [prompt, setPrompt] = useState(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [hasShared, setHasShared] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(localStorage.getItem('dontShowShareModal') === 'true');
  const PAGE_SIZE = 50;

  const MOOD_MAP = {
    happy: "😊",
    calm: "😌",
    neutral: "😐",
    grateful: "🙏",
    blessed: "🙌",
    inspired: "✨",
    loved: "🥰",
    hopeful: "🌱",
    peaceful: "🕊️",
    thankful: "💖",
    joyful: "😄",
    content: "😇",
    uplifted: "🌤️",
    cherished: "💝",
  };

  const VISIBILITY_LABEL = {
    private: "🔒 Private",
    friends: "👥 Friends",
    public: "🌍 Public",
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

  // Share function
  function shareToPlatform(platform, entryText) {
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
      setHasShared(true);
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
        body: JSON.stringify({ content: entryText, mood, visibility }),
      });
      if (!res.ok) throw new Error("Failed to add entry");

      const newEntry = await res.json();
      setEntries((prev) => [{ ...newEntry, show: false }, ...prev]);
      setOffset((prev) => prev + 1);
      setContent("");
      setMood("");
      setVisibility("private");

      // Show modal if not opted out and user hasn't shared yet
      if (!dontShowAgain && !hasShared) {
        setShowShareModal(true);
      }

      // Reset hasShared for next entry
      setHasShared(false);

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
              <option value="">Mood (opt.)</option>
              <option value="happy">😊 Happy</option>
              <option value="calm">😌 Calm</option>
              <option value="neutral">😐 Neutral</option>
              <option value="grateful">🙏 Grateful</option>
              <option value="blessed">🙌 Blessed</option>
              <option value="inspired">✨ Inspired</option>
              <option value="loved">🥰 Loved</option>
              <option value="hopeful">🌱 Hopeful</option>
              <option value="peaceful">🕊️ Peaceful</option>
              <option value="thankful">💖 Thankful</option>
              <option value="joyful">😄 Joyful</option>
              <option value="content">😇 Content</option>
              <option value="uplifted">🌤️ Uplifted</option>
              <option value="cherished">💝 Cherished</option>
            </select>

            <select
              className="input"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              aria-label="Who can see this entry"
            >
              <option value="private">🔒 Private</option>
              <option value="friends">👥 Friends</option>
              <option value="public">🌍 Public</option>
            </select>

            <button
              type="button"
              className="btn-help"
              onClick={handleHelpMeOut}
            >
              {loadingPrompt ? "Thinking…" : "Help me out"}
            </button>
          </div>

          <button
            className="btn btn-secondary"
            type="submit"
            disabled={!content.trim()}
          >
            Add Entry
          </button>

          <div className="share-options">
            <span className="share-label">Share:</span>
            <button
              className="btn-share btn-share-twitter btn-share-small"
              onClick={() => shareToPlatform("twitter", content.trim())}
              type="button"
              disabled={!content.trim()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <button
              className="btn-share btn-share-facebook btn-share-small"
              onClick={() => shareToPlatform("facebook", content.trim())}
              type="button"
              disabled={!content.trim()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </button>
          </div>
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
                    {entry.visibility && (
                      <span
                        className="entry-visibility"
                        style={{
                          marginLeft: "0.5rem",
                          fontSize: "0.8rem",
                          color: "var(--muted-text)",
                        }}
                      >
                        {VISIBILITY_LABEL[entry.visibility] || entry.visibility}
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

      {/* Share Modal */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Would you like to share your gratitude with the rest of the world?</h3>
            <div className="modal-share-buttons">
              <button
                className="btn-share btn-share-twitter"
                onClick={() => {
                  shareToPlatform("twitter", content.trim());
                  setShowShareModal(false);
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                Twitter
              </button>
              <button
                className="btn-share btn-share-facebook"
                onClick={() => {
                  shareToPlatform("facebook", content.trim());
                  setShowShareModal(false);
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </button>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => {
                  setDontShowAgain(e.target.checked);
                  localStorage.setItem('dontShowShareModal', e.target.checked);
                }}
              />
              Don't show this again
            </label>
            <button className="btn-close" onClick={() => setShowShareModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
