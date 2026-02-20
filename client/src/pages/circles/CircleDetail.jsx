import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  fetchCircleById,
  fetchCircleMembers,
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
  const [postAnonymously, setPostAnonymously] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [prompt, setPrompt] = useState(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [showExplore, setShowExplore] = useState(false);
  const [entryPositions, setEntryPositions] = useState({});
  const [showArchive, setShowArchive] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersOpen, setMembersOpen] = useState(false);
  const membersDropdownRef = useRef(null);

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
    fetchCircleMembers(token, id).then(setMembers).catch(() => setMembers([]));
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

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        membersDropdownRef.current &&
        !membersDropdownRef.current.contains(e.target)
      ) {
        setMembersOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const visibleEntries = useMemo(() => entries.slice(0, 8), [entries]);
  const archivedEntries = useMemo(() => entries.slice(8), [entries]);

  useEffect(() => {
    if (visibleEntries.length === 0) return;

    const radius = window.innerWidth <= 768 ? 150 : 240;
    const basePadding = window.innerWidth <= 768 ? 12 : 16;
    const maxAttempts = 600;

    setEntryPositions((prev) => {
      const visibleIds = new Set(visibleEntries.map((entry) => entry.id));
      const next = {};
      for (const [id, pos] of Object.entries(prev)) {
        if (visibleIds.has(Number(id))) {
          next[id] = pos;
        }
      }
      const existing = Object.values(next);

      function estimateRadius(entry) {
        const contentLength = (entry.content || "").length;
        const nameLength = (entry.name || "").length;
        const score = contentLength + nameLength * 0.6;
        const min = window.innerWidth <= 768 ? 48 : 58;
        const max = window.innerWidth <= 768 ? 88 : 104;
        return Math.max(min, Math.min(max, 38 + score * 0.38));
      }

      function isFarEnough(x, y, candidateRadius) {
        for (const pos of existing) {
          const dx = x - pos.x;
          const dy = y - pos.y;
          const required = (pos.radius || 52) + candidateRadius + basePadding;
          if (Math.hypot(dx, dy) < required) {
            return false;
          }
        }
        return true;
      }

        for (const entry of visibleEntries) {
        if (next[entry.id]) continue;
        const candidateRadius = estimateRadius(entry);
        const safetyRadius = candidateRadius + 8;
        let placed = false;
        let attempt = 0;

        while (!placed && attempt < maxAttempts) {
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.sqrt(Math.random()) * radius;
          const x = Math.cos(angle) * distance;
          const y = Math.sin(angle) * distance;
          if (isFarEnough(x, y, safetyRadius)) {
            const rotate = (Math.random() * 6 - 3).toFixed(1);
            next[entry.id] = { x, y, rotate, radius: safetyRadius };
            existing.push(next[entry.id]);
            placed = true;
          }
          attempt += 1;
        }

        if (!placed) {
          // Deterministic sweep fallback: try outer rings before giving up.
          let fallbackPlaced = false;
          for (let distance = radius * 0.55; distance <= radius; distance += 14) {
            for (let angleStep = 0; angleStep < 24; angleStep += 1) {
              const angle = (Math.PI * 2 * angleStep) / 24;
              const x = Math.cos(angle) * distance;
              const y = Math.sin(angle) * distance;
              if (isFarEnough(x, y, safetyRadius)) {
                const rotate = (Math.random() * 6 - 3).toFixed(1);
                next[entry.id] = { x, y, rotate, radius: safetyRadius };
                existing.push(next[entry.id]);
                fallbackPlaced = true;
                break;
              }
            }
            if (fallbackPlaced) break;
          }

          if (!fallbackPlaced) {
            // Last resort: place on perimeter with stable spacing.
            const angle = (Math.PI * 2 * existing.length) / Math.max(visibleEntries.length, 1);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const rotate = (Math.random() * 6 - 3).toFixed(1);
            next[entry.id] = { x, y, rotate, radius: safetyRadius };
            existing.push(next[entry.id]);
          }
        }
      }
      return next;
    });
  }, [visibleEntries]);

  if (error) return <p>{error}</p>;
  if (!circle) return <p>Loading…</p>;

  async function handlePost() {
    if (!newEntry.trim() || isPosting) return;

    setIsPosting(true);
    setError("");

    try {
      const entry = await createCircleEntry(
        token,
        id,
        newEntry,
        undefined,
        postAnonymously
      );
      setEntries((prev) => [entry, ...prev]);
      setNewEntry("");
      setPostAnonymously(false);
    } catch (err) {
      setError(err.message || "Failed to share gratitude.");
    } finally {
      setIsPosting(false);
    }
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
        <div className="circle-members-dropdown" ref={membersDropdownRef}>
          <button
            type="button"
            className="circle-members-toggle"
            onClick={() => setMembersOpen((prev) => !prev)}
            aria-expanded={membersOpen}
            aria-haspopup="true"
          >
            {circle.member_count} member{circle.member_count !== 1 ? "s" : ""} ▾
          </button>

          <div className={`circle-members-menu ${membersOpen ? "open" : ""}`}>
            {members.length === 0 ? (
              <p className="circle-members-empty">No members found.</p>
            ) : (
              <ul className="circle-members-list">
                {members.map((member) => (
                  <li key={member.id} className="circle-member-item">
                    {member.name || "Unnamed member"}
                    {member.is_owner ? " (Owner)" : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
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
          disabled={isPosting}
        />

        <div className="circle-actions-row">
          <button className="btn btn-primary" onClick={handlePost} disabled={isPosting}>
            {isPosting ? "Sharing..." : "Share Gratitude"}
          </button>

          <button
            type="button"
            className="btn-help"
            onClick={handleHelpMeOut}
          >
            {loadingPrompt ? "Thinking…" : "Help me out"}
          </button>
        </div>

        <label className="checkbox-label circle-anon-toggle">
          <input
            type="checkbox"
            checked={postAnonymously}
            onChange={(e) => setPostAnonymously(e.target.checked)}
            disabled={isPosting}
          />
          Post anonymously in this circle
        </label>

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
