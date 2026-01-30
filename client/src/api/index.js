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
