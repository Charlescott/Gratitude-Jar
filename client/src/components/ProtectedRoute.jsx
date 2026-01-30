import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, token }) {
  if (!token) {
    // User isn’t logged in, redirect to login
    return <Navigate to="/login" replace />;
  }

  // User is authenticated, render the child component
  return children;
}
