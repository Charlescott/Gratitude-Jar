import express from "express";
import pool from "../db/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  sendAccountVerificationEmail,
  sendPasswordResetEmail,
} from "./mailer.js";

const router = express.Router();
let authSchemaReadyPromise = null;

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
  if (!authSchemaReadyPromise) {
    authSchemaReadyPromise = (async () => {
      await pool.query(
        `ALTER TABLE users
         ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT TRUE`
      );
      await pool.query(
        `UPDATE users
         SET email_verified = TRUE
         WHERE email_verified IS NULL`
      );
    })();
  }

  await authSchemaReadyPromise;
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
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
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
      const resetToken = jwt.sign(
        { typ: "reset_password", uid: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
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
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      password_hash,
      payload.uid,
    ]);

    return res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("Password reset error:", err);
    return res.status(400).json({ error: "Reset link is invalid or expired." });
  }
});

export default router;
