import { Navigate } from "react-router-dom";

export default function AdminRoute({ children, token, user }) {
  if (!token) return <Navigate to="/login" replace />;

  if (!user) {
    return (
      <div className="entries-container">
        <div className="entry-card">Loading…</div>
      </div>
    );
  }

  if (!user.is_admin) return <Navigate to="/entries" replace />;

  return children;
}
