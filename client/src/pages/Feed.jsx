import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getRandomQuestion } from "../api/questions";
import { fetchMe, reactToEntry } from "../api";
import Avatar from "../components/Avatar";

const REACTION_PALETTE = ["❤️", "🙏", "👏", "🤗", "🎉"];

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

export default function Feed({ token, onUserUpdated }) {
  const [items, setItems] = useState([]);
  const [entryOffset, setEntryOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const [highlightedId, setHighlightedId] = useState(null);

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

  // Scroll to + highlight a focused entry (when arriving via a notification link).
  useEffect(() => {
    if (!focusId || loading) return;
    const inItems = items.some(
      (slot) => slot.type === "entry" && String(slot.data.id) === String(focusId)
    );
    if (!inItems) {
      // Auto-load more pages if the entry isn't on screen yet (up to a cap).
      if (hasMore && !loadingMore) {
        loadFeed(entryOffset);
      }
      return;
    }
    const el = document.getElementById(`feed-entry-${focusId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(String(focusId));
      const timer = setTimeout(() => setHighlightedId(null), 2400);
      // Drop the param so a manual reload doesn't re-highlight.
      setSearchParams({}, { replace: true });
      return () => clearTimeout(timer);
    }
  }, [
    focusId,
    items,
    loading,
    hasMore,
    loadingMore,
    entryOffset,
    loadFeed,
    setSearchParams,
  ]);

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
      if (onUserUpdated) {
        try {
          const me = await fetchMe(token);
          onUserUpdated({ streak: me.streak });
        } catch {
          // streak update is best-effort
        }
      }
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
          {items.map((slot, idx) => {
            if (slot.type === "inspiration") {
              return (
                <InspirationCard
                  key={`inspiration-${slot.data.id}-${idx}`}
                  quote={slot.data}
                />
              );
            }
            if (slot.type === "news") {
              return (
                <NewsCard
                  key={`news-${slot.data.id}-${idx}`}
                  story={slot.data}
                />
              );
            }
            if (slot.type === "memory") {
              return <MemoryCard key={`memory-${idx}`} data={slot.data} />;
            }
            return (
              <EntryCard
                key={`entry-${slot.data.id}`}
                entry={slot.data}
                token={token}
                isHighlighted={String(slot.data.id) === String(highlightedId)}
                onUpdate={updateEntry}
                onDelete={deleteEntry}
              />
            );
          })}

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

function EntryCard({ entry, token, isHighlighted, onUpdate, onDelete }) {
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

  const [reactions, setReactions] = useState(entry.reactions || {});
  const [myReaction, setMyReaction] = useState(entry.my_reaction || null);
  const [reacting, setReacting] = useState(false);
  const canReact =
    !entry.is_mine && entry.visibility === "public" && Boolean(token);

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
    <article
      className="feed-card"
      id={`feed-entry-${entry.id}`}
      style={
        isHighlighted
          ? {
              outline: "3px solid rgba(37, 99, 235, 0.55)",
              outlineOffset: 0,
              transition: "outline-color 1.2s ease, box-shadow 1.2s ease",
              boxShadow: "0 0 0 6px rgba(37, 99, 235, 0.12)",
            }
          : undefined
      }
    >
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

      {entry.visibility === "public" && (
        <ReactionBar
          reactions={reactions}
          myReaction={myReaction}
          canReact={canReact}
          disabled={reacting}
          onReact={async (emoji) => {
            if (reacting || !canReact) return;
            setReacting(true);
            try {
              const result = await reactToEntry(token, entry.id, emoji);
              setReactions(result.reactions || {});
              setMyReaction(result.my_reaction || null);
            } catch (err) {
              console.error(err);
            } finally {
              setReacting(false);
            }
          }}
        />
      )}

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

function ReactionBar({ reactions, myReaction, canReact, disabled, onReact }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.4rem",
        marginTop: "0.6rem",
      }}
    >
      {REACTION_PALETTE.map((emoji) => {
        const count = reactions[emoji] || 0;
        const active = myReaction === emoji;
        const hidden = !canReact && count === 0;
        if (hidden) return null;
        return (
          <button
            key={emoji}
            type="button"
            onClick={canReact ? () => onReact(emoji) : undefined}
            disabled={!canReact || disabled}
            aria-pressed={active}
            aria-label={`React with ${emoji}${count ? ` (${count})` : ""}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              padding: "0.25rem 0.6rem",
              borderRadius: 999,
              border: active
                ? "1px solid rgba(37, 99, 235, 0.6)"
                : "1px solid rgba(15, 23, 42, 0.12)",
              background: active
                ? "rgba(37, 99, 235, 0.12)"
                : "transparent",
              cursor: canReact ? "pointer" : "default",
              fontSize: "0.95rem",
              lineHeight: 1,
              color: "inherit",
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <span aria-hidden="true">{emoji}</span>
            {count > 0 && (
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
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

function MemoryCard({ data }) {
  const entries = data?.entries || [];
  if (entries.length === 0) return null;
  return (
    <article
      className="feed-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem",
        background:
          "linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(217, 70, 239, 0.06))",
      }}
    >
      <div
        style={{
          fontSize: "0.78rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#d97706",
        }}
      >
        🕰️ On this day
      </div>
      <p
        style={{ margin: 0, fontSize: "0.88rem", color: "var(--muted-text)" }}
      >
        Looking back at what you were grateful for this day in past years.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {entries.map((entry) => {
          const yearsAgo = yearsBetween(entry.created_at);
          return (
            <div
              key={entry.id}
              style={{
                background: "rgba(255, 255, 255, 0.6)",
                borderRadius: 10,
                padding: "0.65rem 0.8rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--muted-text)",
                  marginBottom: "0.25rem",
                }}
              >
                {entry.mood ? `${MOOD_MAP[entry.mood] || ""} ` : ""}
                {yearsAgo > 0
                  ? `${yearsAgo} year${yearsAgo === 1 ? "" : "s"} ago`
                  : "Earlier today"}
                {" · "}
                {new Date(entry.created_at).toLocaleDateString()}
              </div>
              <div style={{ fontSize: "0.95rem" }}>{entry.content}</div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function yearsBetween(iso) {
  const then = new Date(iso);
  const now = new Date();
  let years = now.getUTCFullYear() - then.getUTCFullYear();
  const mNow = now.getUTCMonth();
  const dNow = now.getUTCDate();
  const mThen = then.getUTCMonth();
  const dThen = then.getUTCDate();
  if (mNow < mThen || (mNow === mThen && dNow < dThen)) years--;
  return Math.max(0, years);
}

function NewsCard({ story }) {
  return (
    <article
      className="feed-card"
      style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}
    >
      <div
        style={{
          fontSize: "0.78rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#059669",
        }}
      >
        🌍 {story.source || "News"}
      </div>
      {story.image_url && (
        <img
          src={story.image_url}
          alt=""
          loading="lazy"
          style={{
            width: "100%",
            maxHeight: 220,
            objectFit: "cover",
            borderRadius: 12,
            display: "block",
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      <h3 style={{ margin: 0, fontSize: "1.05rem", lineHeight: 1.3 }}>
        {story.title}
      </h3>
      {story.summary && (
        <p style={{ margin: 0, color: "var(--muted-text)", fontSize: "0.92rem" }}>
          {story.summary}
        </p>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "0.25rem",
        }}
      >
        <a
          href={story.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#2563eb",
            fontWeight: 600,
            fontSize: "0.9rem",
            textDecoration: "none",
          }}
        >
          Read full story →
        </a>
        {story.published_at && (
          <span style={{ fontSize: "0.78rem", color: "var(--muted-text)" }}>
            {formatTime(story.published_at)}
          </span>
        )}
      </div>
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
