import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchCircleById } from "../../api";

export default function CircleDetail({ token }) {
  const { id } = useParams();
  const [circle, setCircle] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCircleById(token, id)
      .then(setCircle)
      .catch((err) => setError(err.message));
  }, [id, token]);

  if (error) return <p>{error}</p>;
  if (!circle) return <p>Loading…</p>;

  return (
    
    <div className="circle-detail">
      {/* Header */}
      <section className="circle-header">
        <h1>{circle.name}</h1>
        <p>
          {circle.member_count} member{circle.member_count !== 1 ? "s" : ""}
        </p>
      </section>

      {/* Shared Gratitude (empty for now) */}
      <section className="circle-gratitude">
        <h2>Shared Gratitude</h2>
        <p className="muted">
          Nothing has been shared yet. Be the first to start the ripple.
        </p>
      </section>

      {/* Actions */}
      <section className="circle-actions">
        <button className="btn btn-primary" disabled>
          Share Gratitude
        </button>
      </section>
    </div>
  );
}
