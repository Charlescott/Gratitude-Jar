import { useCallback, useEffect, useState } from "react";
import { getRandomQuestion } from "../api/questions";
import { reactToEntry } from "../api";
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
            return (
              <EntryCard
                key={`entry-${slot.data.id}`}
                entry={slot.data}
                token={token}
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

function EntryCard({ entry, token, onUpdate, onDelete }) {
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
        🌍 Good news{story.source ? ` · ${story.source}` : ""}
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
