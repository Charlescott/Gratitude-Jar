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

  useEffect(() => {
    fetchCircleById(token, id)
      .then(setCircle)
      .catch((err) => setError(err.message));
    fetchCircleEntries(token, id).then(setEntries);
  }, [id, token]);

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
        <h2>Shared Gratitude</h2>
        {entries.length === 0 ? (
          <p className="muted">
            Nothing has been shared yet. Be the first to start the ripple.
          </p>
        ) : (
          <div className="entries-list">
            {entries.map((e) => (
              <div key={e.id} className="entry-card">
                <p>{e.content}</p>
                <small>{e.name}</small>
              </div>
            ))}
          </div>
        )}
      </section>

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
