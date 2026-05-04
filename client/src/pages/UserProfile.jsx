import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchUserProfile } from "../api";
import Avatar from "../components/Avatar";

const PAGE_SIZE = 20;

const MOOD_MAP = {
  happy: "😊", calm: "😌", neutral: "😐", grateful: "🙏", blessed: "🙌",
  inspired: "✨", loved: "🥰", hopeful: "🌱", peaceful: "🕊️", thankful: "💖",
  joyful: "😄", content: "😇", uplifted: "🌤️", cherished: "💝",
};

export default function UserProfile({ token }) {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError("");
    setEntries([]);
    setOffset(0);
    setHasMore(false);
    setProfile(null);
    (async () => {
      try {
        const data = await fetchUserProfile(token, id, {
          limit: PAGE_SIZE,
          offset: 0,
        });
        if (canceled) return;
        setProfile(data.profile);
        setEntries(data.entries || []);
        setHasMore(Boolean(data.hasMore));
        setOffset((data.entries || []).length);
      } catch (err) {
        if (!canceled) setError(err.message);
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [token, id]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchUserProfile(token, id, {
        limit: PAGE_SIZE,
        offset,
      });
      setEntries((prev) => [...prev, ...(data.entries || [])]);
      setHasMore(Boolean(data.hasMore));
      setOffset((prev) => prev + (data.entries || []).length);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <div className="entry-card entries-container">
        <p>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="entry-card entries-container">
        <p style={{ color: "#dc2626" }}>{error}</p>
      </div>
    );
  }

  if (!profile) return null;

  const display = profile.name || "Someone";

  return (
    <div className="entries-container">
      <div
        className="entry-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        <Avatar src={profile.avatar_url} name={display} size={72} />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>{display}</h1>
          {profile.member_since && (
            <p style={{ margin: "0.25rem 0 0", color: "var(--muted-text)", fontSize: "0.85rem" }}>
              Member since {new Date(profile.member_since).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {!profile.is_profile_public ? (
        <div className="entry-card" style={{ textAlign: "center", padding: "2rem" }}>
          <h2 style={{ margin: "0 0 0.5rem" }}>🔒 This profile is private</h2>
          <p style={{ margin: 0, color: "var(--muted-text)" }}>
            {display} hasn't made their gratitude entries public.
          </p>
        </div>
      ) : entries.length === 0 ? (
        <div className="entry-card" style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ margin: 0, color: "var(--muted-text)" }}>
            No public entries to show yet.
          </p>
        </div>
      ) : (
        <>
          <h2 style={{ margin: "0 0 0.75rem" }}>Public entries</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {entries.map((entry) => (
              <li key={entry.id} className="entry-item show">
                <div className="entry-item-content">
                  <strong>
                    {new Date(entry.created_at).toLocaleDateString()}:
                  </strong>{" "}
                  {entry.content}
                  {entry.mood && (
                    <span className="entry-mood">{MOOD_MAP[entry.mood]}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {hasMore && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadMore}
              disabled={loadingMore}
              style={{ marginTop: "1rem" }}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
