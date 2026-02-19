import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function getFromAddress(from) {
  const match = from?.match(/<([^>]+)>/);
  return (match ? match[1] : from || "").trim().toLowerCase();
}

function getDomainFromEmail(email) {
  const atIndex = email.indexOf("@");
  return atIndex > -1 ? email.slice(atIndex + 1).toLowerCase() : "";
}

function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function makeEntityRefId(userId, to) {
  const day = new Date().toISOString().slice(0, 10);
  return `gratitude-reminder-${userId || to}-${day}`.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function makeMessageId(entityRefId, fromDomain) {
  const ts = Date.now();
  return `<${entityRefId}.${ts}@${fromDomain || "localhost"}>`;
}

function createUnsubscribeToken({ userId, email }) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required to create unsubscribe tokens.");
  }

  return jwt.sign(
    {
      typ: "reminder_unsubscribe",
      uid: userId,
      email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "90d" }
  );
}

function buildReminderMessage(name, appBaseUrl, logoUrl, unsubscribeUrl) {
  const baseUrl = appBaseUrl.replace(/\/$/, "");
  const entriesUrl = `${baseUrl}/entries`;

  return {
    subject: "Gratitude reminder",
    text: `Hi ${name},

This is your reminder to add a gratitude entry.

Open your journal:
${entriesUrl}

Unsubscribe:
${unsubscribeUrl}
`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <div style="margin-bottom: 16px;">
          <img src="${logoUrl}" alt="Gratuity Jar" width="72" height="72" style="display:block; width:72px; height:72px; border-radius: 18px;" />
        </div>
        <p>Hi ${name},</p>
        <p>This is your reminder to add a gratitude entry.</p>
        <p>
          <a
            href="${entriesUrl}"
            style="
              display:inline-block;
              padding:12px 28px;
              min-width:140px;
              border-radius:999px;
              text-align:center;
              font-weight:600;
              color:#ffffff;
              background:linear-gradient(135deg, #2f80ed, #27ae60);
              text-decoration:none;
              box-shadow:0 8px 20px rgba(0,0,0,0.15);
            "
          >
            Open Gratitude Jar
          </a>
        </p>
        <p style="font-size: 12px; color: #64748b;">
          If you no longer want reminders, <a href="${unsubscribeUrl}">unsubscribe</a>.
        </p>
      </div>
    `,
  };
}

async function sendWithResend({
  to,
  from,
  subject,
  text,
  html,
  listUnsubscribe,
  entityRefId,
  messageId,
  unsubscribeUrl,
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
      headers: {
        "List-Unsubscribe": listUnsubscribe,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Entity-Ref-ID": entityRefId,
        "Message-ID": messageId,
        "X-List-Unsubscribe-URL": unsubscribeUrl,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend send failed: ${response.status} ${body}`);
  }
}

export async function sendReminderEmail(to, name, options = {}) {
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const supportAddress = process.env.EMAIL_SUPPORT || from;
  const appBaseUrl = process.env.APP_URL || "https://gratuity-jar.vercel.app";
  const apiBaseUrl =
    process.env.API_URL || "https://gratuity-jar-api.onrender.com";
  const normalizedBaseUrl = appBaseUrl.replace(/\/$/, "");
  const normalizedApiBaseUrl = apiBaseUrl.replace(/\/$/, "");
  const logoUrl = process.env.APP_LOGO_URL || `${normalizedBaseUrl}/logo.png`;
  const userId = options.userId || null;

  const unsubscribeToken = createUnsubscribeToken({ userId, email: to });
  const unsubscribeUrl = `${normalizedApiBaseUrl}/reminders/unsubscribe?token=${encodeURIComponent(
    unsubscribeToken
  )}`;
  const listUnsubscribe = `<mailto:${supportAddress}?subject=unsubscribe>, <${unsubscribeUrl}>`;
  const message = buildReminderMessage(
    name,
    appBaseUrl,
    logoUrl,
    unsubscribeUrl
  );

  const fromAddress = getFromAddress(from);
  const fromDomain = getDomainFromEmail(fromAddress);
  const appDomain = getDomainFromUrl(normalizedBaseUrl);
  if (fromDomain && appDomain && fromDomain !== appDomain) {
    console.warn(
      `Email domain alignment warning: from domain "${fromDomain}" differs from app domain "${appDomain}".`
    );
  }

  const entityRefId = makeEntityRefId(userId, to);
  const messageId = makeMessageId(entityRefId, fromDomain);

  if (process.env.RESEND_API_KEY) {
    await sendWithResend({
      to,
      from,
      subject: message.subject,
      text: message.text,
      html: message.html,
      listUnsubscribe,
      entityRefId,
      messageId,
      unsubscribeUrl,
    });

    console.log(`📧 Reminder sent via Resend to ${to}`);
    return;
  }

  await transporter.sendMail({
    from,
    to,
    replyTo: supportAddress,
    subject: message.subject,
    text: message.text,
    html: message.html,
    headers: {
      "List-Unsubscribe": listUnsubscribe,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      "X-Entity-Ref-ID": entityRefId,
      "X-List-Unsubscribe-URL": unsubscribeUrl,
    },
    messageId,
  });

  console.log(`📧 Reminder sent to ${to}`);
}
