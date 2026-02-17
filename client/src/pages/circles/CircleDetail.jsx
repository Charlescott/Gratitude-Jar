import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import {
  fetchCircleById,
  fetchCircleEntries,
  createCircleEntry,
  deleteCircleEntry,
  leaveCircle,
  deleteCircle,
} from "../../api";
import { getRandomQuestion } from "../../api/questions";

export default function CircleDetail({ token }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [circle, setCircle] = useState(null);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState([]);
  const [newEntry, setNewEntry] = useState("");
  const [prompt, setPrompt] = useState(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [showExplore, setShowExplore] = useState(false);
  const [entryPositions, setEntryPositions] = useState({});
  const [showArchive, setShowArchive] = useState(false);

  useEffect(() => {
    // Prevent stale content from previous circle while new route data loads.
    setCircle(null);
    setEntries([]);
    setEntryPositions({});
    setError("");

    fetchCircleById(token, id)
      .then(setCircle)
      .catch((err) => setError(err.message));
    fetchCircleEntries(token, id).then(setEntries);
  }, [id, token]);

  useEffect(() => {
    document.body.classList.add("circles-celebrating");
    document.body.classList.add("circle-detail-view");

    return () => {
      document.body.classList.remove("circles-celebrating");
      document.body.classList.remove("circle-detail-view");
    };
  }, [id]);

  useEffect(() => {
    const flag = localStorage.getItem("show_explore_prompt");
    if (flag) {
      setShowExplore(true);
      localStorage.removeItem("show_explore_prompt");
    }
  }, []);

  const visibleEntries = useMemo(() => entries.slice(0, 10), [entries]);
  const archivedEntries = useMemo(() => entries.slice(10), [entries]);

  useEffect(() => {
    if (visibleEntries.length === 0) return;

    const radius = window.innerWidth <= 768 ? 150 : 220;
    const minDistance = window.innerWidth <= 768 ? 90 : 120;
    const maxAttempts = 200;

    setEntryPositions((prev) => {
      const visibleIds = new Set(visibleEntries.map((entry) => entry.id));
      const next = {};
      for (const [id, pos] of Object.entries(prev)) {
        if (visibleIds.has(Number(id))) {
          next[id] = pos;
        }
      }
      const existing = Object.values(next);

      function isFarEnough(x, y) {
        for (const pos of existing) {
          const dx = x - pos.x;
          const dy = y - pos.y;
          if (Math.hypot(dx, dy) < minDistance) {
            return false;
          }
        }
        return true;
      }

      for (const entry of visibleEntries) {
        if (next[entry.id]) continue;
        let placed = false;
        let attempt = 0;
        let best = null;

        while (!placed && attempt < maxAttempts) {
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.sqrt(Math.random()) * radius;
          const x = Math.cos(angle) * distance;
          const y = Math.sin(angle) * distance;
          if (isFarEnough(x, y)) {
            const rotate = (Math.random() * 6 - 3).toFixed(1);
            next[entry.id] = { x, y, rotate };
            existing.push(next[entry.id]);
            placed = true;
          } else if (!best || Math.hypot(x, y) > Math.hypot(best.x, best.y)) {
            best = { x, y };
          }
          attempt += 1;
        }

        if (!placed) {
          const fallback = best || { x: 0, y: 0 };
          const rotate = (Math.random() * 6 - 3).toFixed(1);
          next[entry.id] = { x: fallback.x, y: fallback.y, rotate };
          existing.push(next[entry.id]);
        }
      }
      return next;
    });
  }, [visibleEntries]);

  if (error) return <p>{error}</p>;
  if (!circle) return <p>Loading…</p>;

  async function handlePost() {
    if (!newEntry.trim()) return;

    const entry = await createCircleEntry(token, id, newEntry);
    setEntries((prev) => [entry, ...prev]);
    setNewEntry("");
  }

  async function handleDeleteEntry(entryId) {
    const ok = window.confirm("Delete this entry?");
    if (!ok) return;

    try {
      await deleteCircleEntry(token, id, entryId);
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    } catch (err) {
      alert(err.message);
    }
  }

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

  async function handleLeave() {
    const ok = window.confirm(
      "Leave this circle? You will lose access to its shared gratitude.",
    );
    if (!ok) return;

    try {
      await leaveCircle(token, id);
      navigate("/circles");
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete() {
    const ok = window.confirm(
      "Delete this circle for everyone? This cannot be undone.",
    );
    if (!ok) return;

    try {
      await deleteCircle(token, id);
      navigate("/circles");
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className={`circle-detail ${entries.length ? "has-entries" : "no-entries"}`}>
      {/* Header */}
      <section className="circle-header">
        <h1>{circle.name}</h1>
        <p>
          {circle.member_count} member{circle.member_count !== 1 ? "s" : ""}
        </p>
        {circle.is_owner && circle.invite_key && (
          <button
            className="btn-help circle-invite-btn"
            onClick={() => {
              const link = `${window.location.origin}/?join=${circle.invite_key}`;
              navigator.clipboard.writeText(link);
              alert("Invite link copied to clipboard!");
            }}
          >
            Invite people
          </button>
        )}
      </section>

      {/* Shared Gratitude (empty for now) */}
      <section className="circle-gratitude">
        {visibleEntries.length === 0 ? (
          <p className="muted">
            Nothing has been shared yet. Be the first to start the ripple.
          </p>
        ) : (
          <div className="entries-list">
            {visibleEntries.map((e) => (
              <div
                key={e.id}
                className="circle-entry-card"
                style={{
                  left: `calc(50% + ${entryPositions[e.id]?.x || 0}px)`,
                  top: `calc(50% + ${entryPositions[e.id]?.y || 0}px)`,
                  transform: `translate(-50%, -50%) rotate(${
                    entryPositions[e.id]?.rotate || 0
                  }deg)`,
                }}
              >
                {e.is_mine && (
                  <button
                    type="button"
                    className="circle-entry-delete"
                    onClick={() => handleDeleteEntry(e.id)}
                    aria-label="Delete entry"
                    title="Delete entry"
                  >
                    ×
                  </button>
                )}
                <p>{e.content}</p>
                <small className="circle-entry-author">
                  <span className="circle-entry-dash">–</span> {e.name}
                </small>
              </div>
            ))}
          </div>
        )}
      </section>

      {showExplore && (
        <section className="circle-explore">
          <p className="circle-explore-title">Explore more of Gratuity</p>
          <p className="circle-explore-text">
            You can also keep personal gratitude entries and set reminders.
          </p>
          <div className="circle-explore-actions">
            <button
              className="btn-help circle-explore-link"
              onClick={() => navigate("/entries")}
            >
              Go to Entries
            </button>
            <button
              className="btn-help circle-explore-link"
              onClick={() => navigate("/reminders")}
            >
              Set Reminders
            </button>
            <button
              className="circle-explore-dismiss"
              onClick={() => setShowExplore(false)}
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      {/* Actions */}
      <section className="circle-actions">
        <textarea
          value={newEntry}
          onChange={(e) => setNewEntry(e.target.value)}
          placeholder={prompt || "Share something you're grateful for..."}
        />

        <div className="circle-actions-row">
          <button className="btn btn-primary" onClick={handlePost}>
            Share Gratitude
          </button>

          <button
            type="button"
            className="btn-help"
            onClick={handleHelpMeOut}
          >
            {loadingPrompt ? "Thinking…" : "Help me out"}
          </button>
        </div>

        {archivedEntries.length > 0 && (
          <div className="circle-archive">
            <button
              type="button"
              className="circle-archive-toggle"
              onClick={() => setShowArchive((prev) => !prev)}
            >
              {showArchive
                ? "Hide older entries"
                : `View older entries (${archivedEntries.length})`}
            </button>

            {showArchive && (
              <div className="circle-archive-list">
                {archivedEntries.map((entry) => (
                  <div key={entry.id} className="circle-archive-item">
                    <p>{entry.content}</p>
                    <small className="circle-entry-author">
                      <span className="circle-entry-dash">–</span> {entry.name}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Membership actions */}
      <section className="circle-member-actions">
        {circle.is_owner ? (
          <button className="circle-danger-link" onClick={handleDelete}>
            Delete Circle
          </button>
        ) : (
          <button className="circle-danger-link" onClick={handleLeave}>
            Leave Circle
          </button>
        )}
      </section>
    </div>
  );
}
