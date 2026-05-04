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

export async function forgotPassword(email) {
  const response = await fetch(`${API}/auth/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Failed to request password reset");
  }

  return result;
}

export async function resetPassword({ token, password }) {
  const response = await fetch(`${API}/auth/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, password }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Failed to reset password");
  }

  return result;
}

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchMe(token) {
  const res = await fetch(`${API}/auth/me`, {
    headers: authHeaders(token),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to load user");
  return result;
}

export async function updateProfile(token, updates) {
  const res = await fetch(`${API}/auth/me`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(updates),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to update profile");
  return result;
}

export async function changePassword(token, current_password, new_password) {
  const res = await fetch(`${API}/auth/me/password`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ current_password, new_password }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to change password");
  return result;
}

export async function presignAvatarUpload(token, contentType, contentLength) {
  const res = await fetch(`${API}/auth/me/avatar/presign`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      content_type: contentType,
      content_length: contentLength,
    }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to prepare upload");
  return result;
}

export async function reactToEntry(token, entryId, emoji) {
  const res = await fetch(`${API}/entries/${entryId}/reactions`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ emoji }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to react");
  return result;
}

export async function fetchUserProfile(token, userId, { limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const res = await fetch(`${API}/users/${userId}/profile?${params}`, {
    headers: authHeaders(token),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to load profile");
  return result;
}

export async function fetchEntryReactors(token, entryId) {
  const res = await fetch(`${API}/entries/${entryId}/reactions`, {
    headers: authHeaders(token),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to load reactors");
  return result;
}

export async function clearReaction(token, entryId) {
  const res = await fetch(`${API}/entries/${entryId}/reactions`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to remove reaction");
  return result;
}

export async function removeAvatar(token) {
  const res = await fetch(`${API}/auth/me/avatar`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to remove avatar");
  return result;
}

export async function fetchAdminOverview(token) {
  const res = await fetch(`${API}/admin/overview`, {
    headers: authHeaders(token),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to load admin overview");
  return result;
}

export async function fetchAdminUsers(
  token,
  { limit = 200, offset = 0, orderBy = "created_at", direction = "desc" } = {}
) {
  const res = await fetch(
    `${API}/admin/users?limit=${limit}&offset=${offset}&orderBy=${encodeURIComponent(
      orderBy
    )}&direction=${encodeURIComponent(direction)}`,
    {
      headers: authHeaders(token),
    }
  );
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to load users");
  return result;
}

export async function fetchAdminCircles(token, { limit = 100, offset = 0 } = {}) {
  const res = await fetch(`${API}/admin/circles?limit=${limit}&offset=${offset}`, {
    headers: authHeaders(token),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to load circles");
  return result;
}

export async function fetchCircles(token) {
  const res = await fetch(`${API}/circles`, {
    cache: "no-store",
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
    cache: "no-store",
    headers: authHeaders(token),
  });

  if (!res.ok) throw new Error("Failed to load circle");
  return res.json();
}

export async function fetchCircleMembers(token, id) {
  const res = await fetch(`${API}/circles/${id}/members`, {
    cache: "no-store",
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

export async function fetchCircleEntries(token, id, { limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (limit != null) params.set("limit", String(limit));
  if (offset != null) params.set("offset", String(offset));

  const res = await fetch(`${API}/circles/${id}/entries?${params.toString()}`, {
    cache: "no-store",
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
