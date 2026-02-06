import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

import {
  fetchCircleById,
  fetchCircleEntries,
  createCircleEntry,
  leaveCircle,
  deleteCircle,
} from "../../api";

export default function CircleDetail({ token }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [circle, setCircle] = useState(null);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState([]);
  const [newEntry, setNewEntry] = useState("");
  const [showExplore, setShowExplore] = useState(false);
  const [entryPositions, setEntryPositions] = useState({});

  useEffect(() => {
    fetchCircleById(token, id)
      .then(setCircle)
      .catch((err) => setError(err.message));
    fetchCircleEntries(token, id).then(setEntries);
  }, [id, token]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      document.body.classList.remove("circles-celebrating");
    }, 1200);

    document.body.classList.add("circles-celebrating");

    return () => {
      clearTimeout(timeout);
      document.body.classList.remove("circles-celebrating");
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
    if (entries.length === 0) return;

    const radius = window.innerWidth <= 768 ? 150 : 220;

    setEntryPositions((prev) => {
      const next = { ...prev };
      for (const entry of entries) {
        if (next[entry.id]) continue;
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.sqrt(Math.random()) * radius;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        const rotate = (Math.random() * 6 - 3).toFixed(1);
        next[entry.id] = { x, y, rotate };
      }
      return next;
    });
  }, [entries]);

  if (error) return <p>{error}</p>;
  if (!circle) return <p>Loading…</p>;

  async function handlePost() {
    if (!newEntry.trim()) return;

    const entry = await createCircleEntry(token, id, newEntry);
    setEntries((prev) => [entry, ...prev]);
    setNewEntry("");
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
    <div className="circle-detail">
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
              const link = `${window.location.origin}/circles/join/${circle.invite_key}`;
              navigator.clipboard.writeText(link);
              alert("Invite link copied to clipboard!");
            }}
          >
            Invite people
          </button>
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

      {/* Shared Gratitude (empty for now) */}
      <section className="circle-gratitude">
        {entries.length === 0 ? (
          <p className="muted">
            Nothing has been shared yet. Be the first to start the ripple.
          </p>
        ) : (
          <div className="entries-list">
            {entries.map((e) => (
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
          placeholder="Share something you're grateful for..."
        />

        <button className="btn btn-primary" onClick={handlePost}>
          Share Gratitude
        </button>
      </section>
    </div>
  );
}
