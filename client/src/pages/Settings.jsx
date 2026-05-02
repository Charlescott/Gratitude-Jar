import { useEffect, useRef, useState } from "react";
import {
  changePassword,
  fetchMe,
  presignAvatarUpload,
  removeAvatar,
  updateProfile,
} from "../api";
import Avatar from "../components/Avatar";
import {
  getCurrentPushSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "../lib/push";

const AVATAR_MAX_PX = 512;
const AVATAR_OUTPUT_TYPE = "image/webp";
const AVATAR_OUTPUT_EXT_TYPE = "image/webp";
const AVATAR_QUALITY = 0.9;

async function resizeImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, AVATAR_MAX_PX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
      AVATAR_OUTPUT_TYPE,
      AVATAR_QUALITY
    );
  });
  return blob;
}

export default function Settings({ token, onUserUpdated }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const me = await fetchMe(token);
        if (!canceled) setUser(me);
      } catch (err) {
        if (!canceled) setLoadError(err.message);
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [token]);

  function applyUserUpdate(next) {
    setUser((prev) => ({ ...(prev || {}), ...next }));
    if (onUserUpdated) {
      onUserUpdated(next);
    } else {
      try {
        const raw = localStorage.getItem("user");
        const current = raw ? JSON.parse(raw) : {};
        localStorage.setItem(
          "user",
          JSON.stringify({ ...current, ...next })
        );
      } catch {
        // ignore
      }
    }
  }

  if (loading) {
    return (
      <div className="entry-card entries-container">
        <h1 className="entries-header">Settings</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="entry-card entries-container">
        <h1 className="entries-header">Settings</h1>
        <p style={{ color: "#dc2626" }}>{loadError}</p>
      </div>
    );
  }

  return (
    <div className="entry-card entries-container">
      <h1 className="entries-header">Settings</h1>

      <AvatarSection
        token={token}
        user={user}
        onUpdated={applyUserUpdate}
      />

      <NicknameSection
        token={token}
        user={user}
        onUpdated={applyUserUpdate}
      />

      <EmailSection token={token} user={user} onUpdated={applyUserUpdate} />

      <PasswordSection token={token} />

      <PushSection token={token} />
    </div>
  );
}

function PushSection({ token }) {
  const [supported] = useState(() => isPushSupported());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supported) return;
    let canceled = false;
    (async () => {
      try {
        const sub = await getCurrentPushSubscription();
        if (!canceled) setSubscribed(Boolean(sub));
      } catch {
        // ignore
      }
    })();
    return () => {
      canceled = true;
    };
  }, [supported]);

  async function handleEnable() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await subscribeToPush(token);
      setSubscribed(true);
      setMessage("Push notifications enabled.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await unsubscribeFromPush(token);
      setSubscribed(false);
      setMessage("Push notifications disabled.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Push notifications">
      {!supported ? (
        <p style={{ margin: 0, color: "var(--muted-text)" }}>
          Your browser doesn't support push notifications.
        </p>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted-text)" }}>
            Get a daily nudge if your streak is about to break. We'll only ping
            you when there's a streak to save.
          </p>
          {subscribed ? (
            <button
              type="button"
              className="btn"
              onClick={handleDisable}
              disabled={busy}
              style={{ alignSelf: "flex-start" }}
            >
              {busy ? "…" : "Disable push notifications"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleEnable}
              disabled={busy}
              style={{ alignSelf: "flex-start" }}
            >
              {busy ? "Enabling…" : "Enable push notifications"}
            </button>
          )}
          {message && <p style={{ margin: 0, color: "#059669" }}>{message}</p>}
          {error && <p style={{ margin: 0, color: "#dc2626" }}>{error}</p>}
        </>
      )}
    </Section>
  );
}

const FORM_MAX_WIDTH = 420;

function Section({ title, children }) {
  return (
    <section
      style={{
        borderTop: "1px solid rgba(15, 23, 42, 0.08)",
        paddingTop: "1.25rem",
        marginTop: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

const formStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.6rem",
  maxWidth: FORM_MAX_WIDTH,
  width: "100%",
};

function AvatarSection({ token, user, onUpdated }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setMessage("");
    setUploading(true);
    try {
      const blob = await resizeImage(file);
      const presign = await presignAvatarUpload(
        token,
        AVATAR_OUTPUT_EXT_TYPE,
        blob.size
      );

      const putRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": AVATAR_OUTPUT_EXT_TYPE },
        body: blob,
      });
      if (!putRes.ok) throw new Error("Upload failed");

      const updated = await updateProfile(token, { avatar_url: presign.publicUrl });
      onUpdated({ avatar_url: updated.avatar_url });
      setMessage("Profile picture updated.");
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!user?.avatar_url) return;
    setError("");
    setMessage("");
    try {
      await removeAvatar(token);
      onUpdated({ avatar_url: null });
      setMessage("Profile picture removed.");
    } catch (err) {
      setError(err.message || "Failed to remove");
    }
  }

  return (
    <Section title="Profile picture">
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Avatar
          src={user?.avatar_url}
          name={user?.name || user?.email}
          size={80}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={uploading}
          />
          {user?.avatar_url && (
            <button
              type="button"
              className="btn"
              onClick={handleRemove}
              disabled={uploading}
              style={{ alignSelf: "flex-start" }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {uploading && <p style={{ margin: 0 }}>Uploading…</p>}
      {message && <p style={{ margin: 0, color: "#059669" }}>{message}</p>}
      {error && <p style={{ margin: 0, color: "#dc2626" }}>{error}</p>}
    </Section>
  );
}

function NicknameSection({ token, user, onUpdated }) {
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSave(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === user?.name) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateProfile(token, { name: trimmed });
      onUpdated({ name: updated.name });
      setMessage("Nickname updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Nickname">
      <form onSubmit={handleSave} style={formStyle}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Nickname"
        />
        <button
          type="submit"
          className="btn btn-secondary"
          disabled={saving || !name.trim() || name.trim() === user?.name}
          style={{ alignSelf: "flex-start" }}
        >
          {saving ? "Saving…" : "Save nickname"}
        </button>
        {message && <p style={{ margin: 0, color: "#059669" }}>{message}</p>}
        {error && <p style={{ margin: 0, color: "#dc2626" }}>{error}</p>}
      </form>
    </Section>
  );
}

function EmailSection({ token, user, onUpdated }) {
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pendingEmail = user?.pending_email || null;

  async function handleSave(e) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || trimmed === user?.email) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateProfile(token, { email: trimmed });
      onUpdated({
        email: updated.email,
        pending_email: updated.pending_email || null,
      });
      setMessage(
        updated.message ||
          (updated.pending_email
            ? `We sent a confirmation link to ${updated.pending_email}. Your email will change once you click it.`
            : "Email updated.")
      );
      setEmail(updated.email);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Email">
      {pendingEmail && (
        <p
          style={{
            margin: 0,
            padding: "0.6rem 0.8rem",
            borderRadius: 8,
            background: "rgba(37, 99, 235, 0.08)",
            color: "var(--text-color)",
            fontSize: "0.9rem",
          }}
        >
          Pending change to <strong>{pendingEmail}</strong> — check that inbox
          for a confirmation link. Your current email is still{" "}
          <strong>{user?.email}</strong> until you confirm.
        </p>
      )}
      <form onSubmit={handleSave} style={formStyle}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <button
          type="submit"
          className="btn btn-secondary"
          disabled={
            saving ||
            !email.trim() ||
            email.trim().toLowerCase() === user?.email
          }
          style={{ alignSelf: "flex-start" }}
        >
          {saving ? "Sending…" : "Send verification to new email"}
        </button>
        {message && <p style={{ margin: 0, color: "#059669" }}>{message}</p>}
        {error && <p style={{ margin: 0, color: "#dc2626" }}>{error}</p>}
      </form>
    </Section>
  );
}

function PasswordSection({ token }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSave(e) {
    e.preventDefault();
    setMessage("");
    setError("");
    if (next.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await changePassword(token, current, next);
      setMessage("Password updated.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Password">
      <form onSubmit={handleSave} style={formStyle}>
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Current password"
          autoComplete="current-password"
          required
        />
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="New password (min 8 chars)"
          autoComplete="new-password"
          required
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          autoComplete="new-password"
          required
        />
        <button
          type="submit"
          className="btn btn-secondary"
          disabled={saving || !current || !next || !confirm}
          style={{ alignSelf: "flex-start" }}
        >
          {saving ? "Saving…" : "Change password"}
        </button>
        {message && <p style={{ margin: 0, color: "#059669" }}>{message}</p>}
        {error && <p style={{ margin: 0, color: "#dc2626" }}>{error}</p>}
      </form>
    </Section>
  );
}
