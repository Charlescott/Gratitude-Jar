const API = import.meta.env.VITE_API;

export async function loginUser(credentials) {
  const response = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Login failed");
  }

  return result;
}

export async function registerUser(credentials) {
  const response = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Registration failed");
  }

  return result;
}

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchCircles(token) {
  const res = await fetch(`${API}/circles`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to load circles");
  return res.json();
}

export async function createCircle(token, name) {
  const res = await fetch(`${API}/circles`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to create circle");
  return res.json();
}

export async function joinCircle(token, key) {
  const res = await fetch(`${API}/circles/join`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ key }),
  });
  if (!res.ok) throw new Error("Invalid circle key");
  return res.json();
}

export async function fetchCircleById(token, id) {
  const res = await fetch(`${API}/circles/${id}`, {
    headers: authHeaders(token),
  });

  if (!res.ok) throw new Error("Failed to load circle");
  return res.json();
}

export async function fetchCircleMembers(token, id) {
  const res = await fetch(`${API}/circles/${id}/members`, {
    headers: authHeaders(token),
  });

  if (!res.ok) throw new Error("Failed to load circle members");
  return res.json();
}

export async function leaveCircle(token, id) {
  const res = await fetch(`${API}/circles/${id}/leave`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  if (!res.ok) throw new Error("Failed to leave circle");
  return res.json();
}

export async function deleteCircle(token, id) {
  const res = await fetch(`${API}/circles/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  if (!res.ok) throw new Error("Failed to delete circle");
  return res.json();
}

export async function fetchCircleEntries(token, id) {
  const res = await fetch(`${API}/circles/${id}/entries`, {
    headers: authHeaders(token),
  });

  if (!res.ok) throw new Error("Failed to load circle entries");
  return res.json();
}

export async function createCircleEntry(
  token,
  id,
  content,
  mood,
  isAnonymous = false
) {
  const res = await fetch(`${API}/circles/${id}/entries`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ content, mood, is_anonymous: isAnonymous }),
  });

  if (!res.ok) throw new Error("Failed to create circle entry");
  return res.json();
}

export async function deleteCircleEntry(token, circleId, entryId) {
  const res = await fetch(`${API}/circles/${circleId}/entries/${entryId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  if (!res.ok) throw new Error("Failed to delete circle entry");
  return res.json();
}
