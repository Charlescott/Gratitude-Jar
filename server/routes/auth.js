import express from "express";
import pool from "../db/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import requireUser from "../middleware/requireUser.js";
import ensureUserSchema from "../db/ensureUserSchema.js";
import {
  sendAccountVerificationEmail,
  sendEmailChangeVerificationEmail,
  sendPasswordResetEmail,
} from "./mailer.js";
import { presignAvatarUpload, deleteAvatar, isR2Configured } from "../lib/r2.js";
import { computeStreak } from "../db/streak.js";

const router = express.Router();

function getAppBaseUrl(req) {
  return (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(
    /\/$/,
    ""
  );
}

function getApiBaseUrl(req) {
  return (process.env.API_URL || `${req.protocol}://${req.get("host")}`).replace(
    /\/$/,
    ""
  );
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

async function ensureAuthSchema() {
  await ensureUserSchema(pool, {
    adminEmail: process.env.ADMIN_EMAIL || "scottfairdosi@yahoo.com",
  });
}

router.post("/register", async (req, res) => {
  const { password, password_confirm, name } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  if (password_confirm !== undefined && password !== password_confirm) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  try {
    await ensureAuthSchema();

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, email_verified)
            VALUES ($1, $2, $3, false) RETURNING id, email, name`,
      [email, hashedPassword, name]
    );

    const user = result.rows[0];
    const apiBaseUrl = getApiBaseUrl(req);
    const verifyToken = jwt.sign(
      { typ: "verify_email", uid: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    const verifyUrl = `${apiBaseUrl}/auth/verify-email?token=${encodeURIComponent(
      verifyToken
    )}`;

    sendAccountVerificationEmail(user.email, {
      recipientName: user.name,
      verifyUrl,
    }).catch((err) => console.error("Verification email error:", err));

    res.status(201).json({
      message:
        "Account created. Please check your email and verify your account before logging in.",
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Email already in use" });
    }
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  const { password } = req.body;
  const email = normalizeEmail(req.body.email);

  try {
    await ensureAuthSchema();

    const result = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        error:
          "Please verify your email before logging in. Check your inbox for the verification link.",
      });
    }

    await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [
      user.id,
    ]);

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url || null,
        is_admin: Boolean(user.is_admin),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", requireUser, async (req, res) => {
  try {
    await ensureAuthSchema();
    const { rows } = await pool.query(
      `SELECT id, email, name, avatar_url, pending_email, pending_email_expires_at,
              created_at, last_login_at, is_admin
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const pendingLive =
      user.pending_email &&
      user.pending_email_expires_at &&
      new Date(user.pending_email_expires_at) > new Date();

    let streak = { current: 0, longest: 0, last_post_date: null };
    try {
      streak = await computeStreak(user.id);
    } catch (streakErr) {
      console.error("computeStreak error:", streakErr);
    }

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url || null,
      pending_email: pendingLive ? user.pending_email : null,
      created_at: user.created_at,
      last_login_at: user.last_login_at,
      is_admin: Boolean(user.is_admin),
      streak,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load user" });
  }
});

router.get("/verify-email", async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send("Missing verification token.");
  }

  try {
    await ensureAuthSchema();
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload?.typ !== "verify_email" || !payload?.uid) {
      return res.status(400).send("Invalid verification token.");
    }

    await pool.query("UPDATE users SET email_verified = true WHERE id = $1", [
      payload.uid,
    ]);

    return res.status(200).send(`
      <html>
        <head><title>Email Verified</title></head>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <h2>Email verified</h2>
          <p>Your account is now active. You can return to the app and log in.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Email verification error:", err);
    return res.status(400).send("Verification link is invalid or expired.");
  }
});

router.get("/confirm-email-change", async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send("Missing confirmation token.");
  }

  try {
    await ensureAuthSchema();
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload?.typ !== "change_email" || !payload?.uid || !payload?.new_email) {
      return res.status(400).send("Invalid confirmation token.");
    }

    const jti = payload?.jti;
    if (!jti) {
      return res.status(400).send("Invalid confirmation token.");
    }

    const newEmail = normalizeEmail(payload.new_email);

    const existing = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2",
      [newEmail, payload.uid]
    );
    if (existing.rows.length > 0) {
      return res
        .status(409)
        .send(
          "That email is already in use by another account. Your email was not changed."
        );
    }

    const update = await pool.query(
      `UPDATE users
       SET email = $1,
           email_verified = TRUE,
           pending_email = NULL,
           pending_email_jti = NULL,
           pending_email_expires_at = NULL
       WHERE id = $2
         AND pending_email_jti = $3
         AND pending_email_expires_at > NOW()
         AND LOWER(pending_email) = LOWER($1)
       RETURNING id`,
      [newEmail, payload.uid, jti]
    );

    if (update.rowCount === 0) {
      return res
        .status(400)
        .send("This confirmation link is invalid or has expired.");
    }

    return res.status(200).send(`
      <html>
        <head><title>Email Updated</title></head>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <h2>Email updated</h2>
          <p>Your account email is now <strong>${newEmail}</strong>. You can return to the app — you may need to log in again with the new address.</p>
        </body>
      </html>
    `);
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(409)
        .send(
          "That email is already in use by another account. Your email was not changed."
        );
    }
    console.error("Email change confirmation error:", err);
    return res
      .status(400)
      .send("This confirmation link is invalid or has expired.");
  }
});

router.post("/forgot-password", async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    await ensureAuthSchema();

    const result = await pool.query(
      "SELECT id, email, name FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (result.rows[0]) {
      const user = result.rows[0];
      const appBaseUrl = getAppBaseUrl(req);
      const jti = crypto.randomUUID();

      await pool.query(
        `UPDATE users
         SET password_reset_jti = $1,
             password_reset_expires_at = NOW() + INTERVAL '30 minutes'
         WHERE id = $2`,
        [jti, user.id]
      );
      const resetToken = jwt.sign(
        { typ: "reset_password", uid: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "30m", jwtid: jti }
      );
      const resetUrl = `${appBaseUrl}/reset-password?token=${encodeURIComponent(
        resetToken
      )}`;
      console.log(`Forgot password requested for existing user: ${user.email}`);
      try {
        await sendPasswordResetEmail(user.email, {
          recipientName: user.name,
          resetUrl,
        });
        console.log(`Password reset email sent: ${user.email}`);
      } catch (mailErr) {
        console.error("Password reset email error:", mailErr);
      }
    } else {
      console.log(`Forgot password requested for unknown email: ${email}`);
    }

    return res.json({
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to process request" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: "Token and password are required" });
  }

  try {
    await ensureAuthSchema();
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload?.typ !== "reset_password" || !payload?.uid) {
      return res.status(400).json({ error: "Invalid reset token" });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const jti = payload?.jti || payload?.jwtid;
    if (!jti) {
      return res.status(400).json({ error: "Invalid reset token" });
    }

    const updateResult = await pool.query(
      `UPDATE users
       SET password_hash = $1,
           password_reset_jti = NULL,
           password_reset_expires_at = NULL
       WHERE id = $2
         AND password_reset_jti = $3
         AND password_reset_expires_at > NOW()`,
      [password_hash, payload.uid, jti]
    );

    if (updateResult.rowCount === 0) {
      console.warn(
        `Password reset rejected (expired or not latest): uid=${payload.uid}`
      );
      return res.status(400).json({ error: "Reset link is invalid or expired." });
    }

    return res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("Password reset error:", err);
    return res.status(400).json({ error: "Reset link is invalid or expired." });
  }
});

router.patch("/me", requireUser, async (req, res) => {
  const { name, email, avatar_url } = req.body || {};
  const updates = [];
  const values = [];
  let idx = 1;

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (trimmed.length === 0 || trimmed.length > 80) {
      return res
        .status(400)
        .json({ error: "Nickname must be between 1 and 80 characters" });
    }
    updates.push(`name = $${idx++}`);
    values.push(trimmed);
  }

  let requestedEmail = null;
  if (email !== undefined) {
    const normalized = normalizeEmail(email);
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return res.status(400).json({ error: "Invalid email address" });
    }
    requestedEmail = normalized;
  }

  if (avatar_url !== undefined) {
    if (avatar_url !== null && typeof avatar_url !== "string") {
      return res.status(400).json({ error: "Invalid avatar_url" });
    }
    updates.push(`avatar_url = $${idx++}`);
    values.push(avatar_url || null);
  }

  if (updates.length === 0 && requestedEmail === null) {
    return res.status(400).json({ error: "No fields to update" });
  }

  try {
    await ensureAuthSchema();

    let previousAvatar = null;
    if (avatar_url !== undefined) {
      const prev = await pool.query(
        "SELECT avatar_url FROM users WHERE id = $1",
        [req.user.id]
      );
      previousAvatar = prev.rows[0]?.avatar_url || null;
    }

    let user;
    if (updates.length > 0) {
      values.push(req.user.id);
      const { rows } = await pool.query(
        `UPDATE users SET ${updates.join(", ")}
         WHERE id = $${idx}
         RETURNING id, email, name, avatar_url, pending_email, is_admin`,
        values
      );
      user = rows[0];
    } else {
      const { rows } = await pool.query(
        `SELECT id, email, name, avatar_url, pending_email, is_admin
         FROM users WHERE id = $1`,
        [req.user.id]
      );
      user = rows[0];
    }

    if (!user) return res.status(404).json({ error: "User not found" });

    if (
      previousAvatar &&
      previousAvatar !== user.avatar_url &&
      isR2Configured()
    ) {
      deleteAvatar(previousAvatar).catch(() => {});
    }

    let pendingEmail = user.pending_email || null;
    let emailVerificationMessage = null;

    if (requestedEmail) {
      if (requestedEmail === user.email) {
        return res
          .status(400)
          .json({ error: "That is already your email address" });
      }

      const existing = await pool.query(
        "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2",
        [requestedEmail, req.user.id]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: "Email already in use" });
      }

      const jti = crypto.randomUUID();
      await pool.query(
        `UPDATE users
         SET pending_email = $1,
             pending_email_jti = $2,
             pending_email_expires_at = NOW() + INTERVAL '24 hours'
         WHERE id = $3`,
        [requestedEmail, jti, req.user.id]
      );
      pendingEmail = requestedEmail;

      const apiBaseUrl = getApiBaseUrl(req);
      const verifyToken = jwt.sign(
        {
          typ: "change_email",
          uid: req.user.id,
          new_email: requestedEmail,
        },
        process.env.JWT_SECRET,
        { expiresIn: "24h", jwtid: jti }
      );
      const verifyUrl = `${apiBaseUrl}/auth/confirm-email-change?token=${encodeURIComponent(
        verifyToken
      )}`;

      sendEmailChangeVerificationEmail(requestedEmail, {
        recipientName: user.name,
        verifyUrl,
        currentEmail: user.email,
      }).catch((err) =>
        console.error("Email-change verification send error:", err)
      );

      emailVerificationMessage = `We sent a confirmation link to ${requestedEmail}. Your email will change once you click it.`;
    }

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url || null,
      pending_email: pendingEmail,
      is_admin: Boolean(user.is_admin),
      ...(emailVerificationMessage
        ? { message: emailVerificationMessage }
        : {}),
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Email already in use" });
    }
    console.error("Update profile error:", err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

router.post("/me/avatar/presign", requireUser, async (req, res) => {
  if (!isR2Configured()) {
    return res.status(503).json({
      error:
        "Avatar uploads are not configured on the server. Ask an admin to set R2 env vars.",
    });
  }
  const { content_type, content_length } = req.body || {};
  try {
    const result = await presignAvatarUpload({
      userId: req.user.id,
      contentType: content_type,
      contentLength: Number(content_length),
    });
    return res.json(result);
  } catch (err) {
    console.error("Avatar presign error:", err);
    return res.status(400).json({ error: err.message || "Failed to presign" });
  }
});

router.delete("/me/avatar", requireUser, async (req, res) => {
  try {
    await ensureAuthSchema();
    const { rows } = await pool.query(
      "SELECT avatar_url FROM users WHERE id = $1",
      [req.user.id]
    );
    const previous = rows[0]?.avatar_url;

    await pool.query(
      "UPDATE users SET avatar_url = NULL WHERE id = $1",
      [req.user.id]
    );

    if (previous && isR2Configured()) {
      deleteAvatar(previous).catch(() => {});
    }

    return res.json({ avatar_url: null });
  } catch (err) {
    console.error("Avatar delete error:", err);
    return res.status(500).json({ error: "Failed to remove avatar" });
  }
});

router.post("/me/password", requireUser, async (req, res) => {
  const { current_password, new_password } = req.body || {};

  if (!current_password || !new_password) {
    return res
      .status(400)
      .json({ error: "Current and new password are required" });
  }

  if (String(new_password).length < 8) {
    return res
      .status(400)
      .json({ error: "New password must be at least 8 characters" });
  }

  try {
    await ensureAuthSchema();
    const { rows } = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [req.user.id]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [newHash, req.user.id]
    );

    return res.json({ message: "Password updated" });
  } catch (err) {
    console.error("Password change error:", err);
    return res.status(500).json({ error: "Failed to change password" });
  }
});

router.post("/delete-account", requireUser, async (req, res) => {
  const { password, confirmation } = req.body || {};

  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  if (String(confirmation || "").trim().toUpperCase() !== "DELETE") {
    return res
      .status(400)
      .json({ error: "Please type DELETE to confirm account deletion." });
  }

  try {
    await ensureAuthSchema();

    const { rows } = await pool.query(
      "SELECT id, password_hash FROM users WHERE id = $1",
      [req.user.id]
    );

    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const deleteResult = await pool.query("DELETE FROM users WHERE id = $1", [
      req.user.id,
    ]);

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ message: "Account deleted" });
  } catch (err) {
    console.error("Delete account error:", err);
    return res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
