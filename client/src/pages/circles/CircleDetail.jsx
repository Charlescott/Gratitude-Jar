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
    <div>
      <h1>{circle.name}</h1>
      <p>Members: {circle.member_count}</p>
    </div>
  );
}

