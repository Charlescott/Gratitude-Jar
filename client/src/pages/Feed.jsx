import { useCallback, useEffect, useState } from "react";
import { getRandomQuestion } from "../api/questions";
import Avatar from "../components/Avatar";

const API = import.meta.env.VITE_API || import.meta.env.VITE_API_URL;
const PAGE_SIZE = 20;

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

export default function Feed({ token }) {
  const [items, setItems] = useState([]);
  const [entryOffset, setEntryOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [visibility, setVisibility] = useState("friends");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [prompt, setPrompt] = useState(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [posting, setPosting] = useState(false);

  const authFetch = useCallback(
    (path, opts = {}) =>
      fetch(`${API}${path}`, {
        ...opts,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(opts.headers || {}),
        },
      }),
    [token]
  );

  const loadFeed = useCallback(
    async (offset) => {
      if (!API || !token) {
        setLoading(false);
        setError(!API ? "API URL is not configured." : "Not logged in.");
        return;
      }
      const firstPage = offset === 0;
      firstPage ? setLoading(true) : setLoadingMore(true);
      setError("");
      try {
        const res = await authFetch(
          `/feed?limit=${PAGE_SIZE}&offset=${offset}`
        );
        if (!res.ok) throw new Error("Failed to load feed");
        const payload = await res.json();
        const newItems = payload.items || [];
        const addedEntries = newItems.filter((i) => i.type === "entry").length;

        setItems((prev) => (firstPage ? newItems : [...prev, ...newItems]));
        setHasMore(Boolean(payload.hasMore));
        setEntryOffset((prev) => (firstPage ? addedEntries : prev + addedEntries));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [authFetch, token]
  );

  useEffect(() => {
    loadFeed(0);
  }, [loadFeed]);

  useEffect(() => {
    document.body.classList.add("feed-view");
    return () => document.body.classList.remove("feed-view");
  }, []);

  async function handleHelpMeOut() {
    setLoadingPrompt(true);
    try {
      const question = await getRandomQuestion();
      setPrompt(question.text);
    } catch {
      // ignore
    } finally {
      setLoadingPrompt(false);
    }
  }

  async function handlePost(e) {
    e.preventDefault();
    const text = content.trim();
    if (!text || posting) return;
    setPosting(true);
    setError("");
    try {
      const res = await authFetch("/entries", {
        method: "POST",
        body: JSON.stringify({
          content: text,
          mood: mood || null,
          visibility,
          is_anonymous: visibility !== "private" && isAnonymous,
        }),
      });
      if (!res.ok) throw new Error("Failed to post entry");
      setContent("");
      setMood("");
      setIsAnonymous(false);
      setPrompt(null);
      await loadFeed(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  async function updateEntry(id, payload) {
    const res = await authFetch(`/entries/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update entry");
    const updated = await res.json();
    if (updated.visibility === "private") {
      setItems((prev) =>
        prev.filter(
          (slot) => !(slot.type === "entry" && slot.data.id === id)
        )
      );
      return;
    }
    setItems((prev) =>
      prev.map((slot) =>
        slot.type === "entry" && slot.data.id === id
          ? {
              ...slot,
              data: {
                ...slot.data,
                content: updated.content,
                mood: updated.mood,
                visibility: updated.visibility,
                is_anonymous: updated.is_anonymous,
              },
            }
          : slot
      )
    );
  }

  async function deleteEntry(id) {
    const res = await authFetch(`/entries/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete entry");
    setItems((prev) =>
      prev.filter((slot) => !(slot.type === "entry" && slot.data.id === id))
    );
  }

  return (
    <div className="feed-page">
      <div className="feed-bg" aria-hidden="true">
        <span className="feed-orb feed-orb-1" />
        <span className="feed-orb feed-orb-2" />
        <span className="feed-orb feed-orb-3" />
      </div>

      <h1 className="feed-title">Your Gratitude Feed</h1>
      <p className="feed-subtitle">
        A quiet place for the good things. Share a moment, read others.
      </p>

      <div className="feed-card feed-composer">
        <form
          onSubmit={handlePost}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={prompt || "What are you grateful for today?"}
            rows={3}
            required
            style={{ resize: "none" }}
          />

          <button
            type="button"
            className="feed-composer-help"
            onClick={handleHelpMeOut}
            disabled={loadingPrompt}
          >
            {loadingPrompt ? "✨ Thinking…" : "✨ Need a prompt?"}
          </button>

          <div className="feed-dropdown-row">
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
              onChange={(e) => {
                const v = e.target.value;
                setVisibility(v);
                if (v === "private") setIsAnonymous(false);
              }}
              aria-label="Who can see this"
            >
              <option value="private">🔒 Private</option>
              <option value="friends">👥 Friends</option>
              <option value="public">🌍 Public</option>
            </select>
          </div>

          {visibility !== "private" && (
            <label className="checkbox-label feed-anon-toggle">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
              />
              Post anonymously
            </label>
          )}

          <button
            className="feed-post-hero"
            type="submit"
            disabled={!content.trim() || posting}
          >
            {posting ? "Posting…" : "Post"}
          </button>
        </form>
      </div>

      {error && (
        <p className="feed-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="feed-empty">Loading feed…</p>
      ) : items.length === 0 ? (
        <div className="feed-card feed-empty-card">
          <p>The feed is quiet right now.</p>
          <p className="feed-empty-sub">
            Be the first to share something you're grateful for, or follow
            people to see their public moments.
          </p>
        </div>
      ) : (
        <>
          {items.map((slot, idx) =>
            slot.type === "inspiration" ? (
              <InspirationCard
                key={`inspiration-${slot.data.id}-${idx}`}
                quote={slot.data}
              />
            ) : (
              <EntryCard
                key={`entry-${slot.data.id}`}
                entry={slot.data}
                onUpdate={updateEntry}
                onDelete={deleteEntry}
              />
            )
          )}

          {hasMore && (
            <button
              type="button"
              className="btn btn-secondary feed-load-more"
              onClick={() => loadFeed(entryOffset)}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function EntryCard({ entry, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(entry.content);
  const [mood, setMood] = useState(entry.mood || "");
  const [visibility, setVisibility] = useState(entry.visibility);
  const [isAnonymousEdit, setIsAnonymousEdit] = useState(
    Boolean(entry.is_anonymous)
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const displayAnonymous = entry.is_anonymous && !entry.is_mine;
  const authorDisplay = displayAnonymous
    ? "Anonymous"
    : entry.author_name || entry.author_email || "Anonymous";
  const avatarUrl = displayAnonymous ? null : entry.author_avatar_url;

  function startEdit() {
    setContent(entry.content);
    setMood(entry.mood || "");
    setVisibility(entry.visibility);
    setIsAnonymousEdit(Boolean(entry.is_anonymous));
    setError("");
    setIsEditing(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    const text = content.trim();
    if (!text || saving) return;
    setSaving(true);
    setError("");
    try {
      await onUpdate(entry.id, {
        content: text,
        mood: mood || null,
        visibility,
        is_anonymous: visibility !== "private" && isAnonymousEdit,
      });
      setIsEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    if (!window.confirm("Delete this entry? This cannot be undone.")) return;
    setDeleting(true);
    setError("");
    try {
      await onDelete(entry.id);
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  if (isEditing) {
    return (
      <article className="feed-card">
        <form
          onSubmit={saveEdit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
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
              onChange={(e) => {
                const v = e.target.value;
                setVisibility(v);
                if (v === "private") setIsAnonymousEdit(false);
              }}
            >
              <option value="private">🔒 Private</option>
              <option value="friends">👥 Friends</option>
              <option value="public">🌍 Public</option>
            </select>
          </div>

          <div className="form-row">
            {visibility !== "private" ? (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isAnonymousEdit}
                  onChange={(e) => setIsAnonymousEdit(e.target.checked)}
                />
                Post anonymously
              </label>
            ) : (
              <span />
            )}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn"
                onClick={() => setIsEditing(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={!content.trim() || saving}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          {error && (
            <p style={{ color: "#dc2626", margin: 0 }} role="alert">
              {error}
            </p>
          )}
        </form>
      </article>
    );
  }

  return (
    <article className="feed-card">
      <div className="feed-card-meta">
        <Avatar
          className="feed-avatar"
          src={avatarUrl}
          name={authorDisplay}
          size={42}
        />
        <div className="feed-card-meta-text">
          <div className="feed-author">
            {authorDisplay}
            {entry.is_mine && entry.is_anonymous && (
              <span className="feed-anon-tag"> (posted anonymously)</span>
            )}
          </div>
          <div className="feed-timestamp">
            {formatTime(entry.created_at)}
            {entry.visibility && (
              <span className="feed-visibility">
                {" · "}
                {VISIBILITY_LABEL[entry.visibility] || entry.visibility}
              </span>
            )}
          </div>
        </div>
        {entry.mood && (
          <span className="feed-mood" aria-label={entry.mood}>
            {MOOD_MAP[entry.mood]}
          </span>
        )}
      </div>
      <div className="feed-card-content">{entry.content}</div>

      {entry.is_mine && (
        <div className="feed-card-actions">
          <button
            type="button"
            className="feed-card-action"
            onClick={startEdit}
            disabled={deleting}
          >
            Edit
          </button>
          <button
            type="button"
            className="feed-card-action feed-card-action-danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}

      {error && (
        <p style={{ color: "#dc2626", marginTop: "0.5rem" }} role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

function InspirationCard({ quote }) {
  return (
    <article className="feed-card feed-inspiration">
      <div className="feed-inspiration-label">✨ Inspiration</div>
      <blockquote className="feed-inspiration-text">{quote.text}</blockquote>
      {quote.author && (
        <div className="feed-inspiration-author">— {quote.author}</div>
      )}
    </article>
  );
}

function formatTime(iso) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
