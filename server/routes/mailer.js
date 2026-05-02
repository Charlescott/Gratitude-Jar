import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function assertEmailProviderConfigured() {
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasSmtp = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

  if (!hasResend && !hasSmtp) {
    throw new Error(
      "Email provider is not configured. Set RESEND_API_KEY or EMAIL_USER/EMAIL_PASS."
    );
  }
}

function normalizeFromField(fromRaw) {
  const raw = String(fromRaw || "").trim();
  const unquoted = raw.replace(/^['"]+|['"]+$/g, "").trim();

  // Allow either "email@example.com" or "Name <email@example.com>"
  const emailOnly = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const namedEmail = /^.+<\s*[^\s@]+@[^\s@]+\.[^\s@]+\s*>$/;

  if (emailOnly.test(unquoted) || namedEmail.test(unquoted)) {
    return unquoted;
  }

  return "";
}

function extractDisplayName(addressField) {
  const raw = String(addressField || "").trim();
  const unquoted = raw.replace(/^['"]+|['"]+$/g, "").trim();
  const match = unquoted.match(/^(.*)<[^>]+>$/);
  return (match ? match[1] : "").trim().replace(/^[\s"'`]+|[\s"'`]+$/g, "");
}

function resolveFromAddress() {
  const primary = normalizeFromField(process.env.EMAIL_FROM);
  const fallback = normalizeFromField(process.env.EMAIL_USER);
  const hasResend = Boolean(process.env.RESEND_API_KEY);

  if (!hasResend && primary && fallback) {
    const primaryEmail = getFromAddress(primary);
    const authEmail = getFromAddress(fallback);
    if (primaryEmail && authEmail && primaryEmail !== authEmail) {
      const name = extractDisplayName(primary) || extractDisplayName(fallback);
      return name ? `${name} <${authEmail}>` : authEmail;
    }
  }

  if (primary) return primary;
  if (fallback) return fallback;
  return "";
}

function assertValidFromAddress(from) {
  if (!from) {
    throw new Error(
      "Invalid EMAIL_FROM/EMAIL_USER format. Use 'email@example.com' or 'Name <email@example.com>'."
    );
  }
}

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
    return null;
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
  const entriesUrl = baseUrl;
  const unsubscribeCopy = unsubscribeUrl || `${baseUrl}/reminders`;

  return {
    subject: "Gratitude reminder",
    text: `Hi ${name},

This is your reminder to add a gratitude entry.

Open your journal:
${entriesUrl}

Unsubscribe:
${unsubscribeCopy}
`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <div style="margin-bottom: 16px;">
          <img src="${logoUrl}" alt="Gratitude Jar" width="72" height="72" style="display:block; width:72px; height:72px; border-radius: 18px;" />
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
              color:#ffffff !important;
              background:#2f80ed;
              background-image:linear-gradient(135deg, #2f80ed, #27ae60);
              text-decoration:none !important;
              border:1px solid #2f80ed;
              box-shadow:0 8px 20px rgba(0,0,0,0.15);
            "
          >
            Open Gratitude Jar
          </a>
        </p>
        <p style="font-size: 12px; color: #64748b;">
          If the button does not display, use this link:
          <a href="${entriesUrl}" style="color:#2f80ed; text-decoration:underline;">${entriesUrl}</a>
        </p>
        <p style="font-size: 12px; color: #64748b;">
          If you no longer want reminders,
          <a href="${unsubscribeCopy}" style="color:#2f80ed; text-decoration:underline;">unsubscribe</a>.
        </p>
      </div>
    `,
  };
}

function buildCircleCheckInMessage(
  recipientName,
  circleName,
  circleUrl,
  logoUrl,
  unsubscribeUrl
) {
  const unsubscribeCopy = unsubscribeUrl || circleUrl;
  const subject = `Hey! Your ${circleName} misses you!`;

  return {
    subject,
    text: `Hi ${recipientName || "there"},

Hey! Your ${circleName} misses you!

Drop in and add an entry to check in with your circle.

Open the circle:
${circleUrl}

Unsubscribe:
${unsubscribeCopy}
`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <div style="margin-bottom: 16px;">
          <img src="${logoUrl}" alt="Gratitude Jar" width="72" height="72" style="display:block; width:72px; height:72px; border-radius: 18px;" />
        </div>
        <p>Hi ${recipientName || "there"},</p>
        <p style="margin: 12px 0 10px 0; font-size: 18px; font-weight: 700;">
          Hey! Your <span style="color:#2563eb;">${circleName}</span> misses you!
        </p>
        <p>Drop in and add an entry to check in with your circle.</p>
        <p>
          <a
            href="${circleUrl}"
            style="
              display:inline-block;
              padding:12px 28px;
              min-width:140px;
              border-radius:999px;
              text-align:center;
              font-weight:600;
              color:#ffffff !important;
              background:#2f80ed;
              background-image:linear-gradient(135deg, #2f80ed, #27ae60);
              text-decoration:none !important;
              border:1px solid #2f80ed;
              box-shadow:0 8px 20px rgba(0,0,0,0.15);
            "
          >
            Open Circle
          </a>
        </p>
        <p style="font-size: 12px; color: #64748b;">
          If the button does not display, use this link:
          <a href="${circleUrl}" style="color:#2f80ed; text-decoration:underline;">${circleUrl}</a>
        </p>
        <p style="font-size: 12px; color: #64748b;">
          If you no longer want reminders,
          <a href="${unsubscribeCopy}" style="color:#2f80ed; text-decoration:underline;">unsubscribe</a>.
        </p>
      </div>
    `,
  };
}

async function sendWithResend({
  to,
  from,
  supportAddress,
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
        ...(supportAddress ? { "Reply-To": supportAddress } : {}),
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend send failed: ${response.status} ${body}`);
  }
}

async function sendAppEmail({
  to,
  from,
  supportAddress,
  subject,
  text,
  html,
  entityRefId,
  messageId,
}) {
  assertEmailProviderConfigured();

  if (process.env.RESEND_API_KEY) {
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
          "X-Entity-Ref-ID": entityRefId,
          "Message-ID": messageId,
          ...(supportAddress ? { "Reply-To": supportAddress } : {}),
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend send failed: ${response.status} ${body}`);
    }
    return;
  }

  await transporter.sendMail({
    from,
    to,
    replyTo: supportAddress,
    subject,
    text,
    html,
    headers: {
      "X-Entity-Ref-ID": entityRefId,
    },
    messageId,
  });
}

export async function sendReminderEmail(to, name, options = {}) {
  assertEmailProviderConfigured();

  const from = resolveFromAddress();
  assertValidFromAddress(from);
  const supportAddress = process.env.EMAIL_SUPPORT || from;
  const supportEmail = getFromAddress(supportAddress) || getFromAddress(from);
  const appBaseUrl = process.env.APP_URL || "https://thegratitudejar.net";
  const apiBaseUrl =
    process.env.API_URL || "https://gratuity-jar-api.onrender.com";
  const normalizedBaseUrl = appBaseUrl.replace(/\/$/, "");
  const normalizedApiBaseUrl = apiBaseUrl.replace(/\/$/, "");
  const logoUrl = process.env.APP_LOGO_URL || `${normalizedBaseUrl}/logo.png`;
  const userId = options.userId || null;

  const unsubscribeToken = createUnsubscribeToken({ userId, email: to });
  const unsubscribeUrl = unsubscribeToken
    ? `${normalizedApiBaseUrl}/reminders/unsubscribe?token=${encodeURIComponent(
        unsubscribeToken
      )}`
    : null;
  const listUnsubscribe = unsubscribeUrl
    ? `<mailto:${supportEmail}?subject=unsubscribe>, <${unsubscribeUrl}>`
    : `<mailto:${supportEmail}?subject=unsubscribe>`;
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
      supportAddress,
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
      ...(unsubscribeUrl ? { "X-List-Unsubscribe-URL": unsubscribeUrl } : {}),
    },
    messageId,
  });

  console.log(`📧 Reminder sent to ${to}`);
}

export async function sendCircleCheckInReminderEmail(
  to,
  { recipientName, circleName, circleId, userId }
) {
  assertEmailProviderConfigured();

  const from = resolveFromAddress();
  assertValidFromAddress(from);
  const supportAddress = process.env.EMAIL_SUPPORT || from;
  const supportEmail = getFromAddress(supportAddress) || getFromAddress(from);

  const appBaseUrl = (process.env.APP_URL || "https://thegratitudejar.net")
    .replace(/\/$/, "");
  const apiBaseUrl =
    (process.env.API_URL || "https://gratuity-jar-api.onrender.com").replace(
      /\/$/,
      ""
    );
  const logoUrl = process.env.APP_LOGO_URL || `${appBaseUrl}/logo.png`;

  const circleUrl = `${appBaseUrl}/circles/${circleId}`;

  const unsubscribeToken = createUnsubscribeToken({ userId, email: to });
  const unsubscribeUrl = unsubscribeToken
    ? `${apiBaseUrl}/reminders/unsubscribe?token=${encodeURIComponent(
        unsubscribeToken
      )}`
    : null;
  const listUnsubscribe = unsubscribeUrl
    ? `<mailto:${supportEmail}?subject=unsubscribe>, <${unsubscribeUrl}>`
    : `<mailto:${supportEmail}?subject=unsubscribe>`;

  const fromAddress = getFromAddress(from);
  const fromDomain = getDomainFromEmail(fromAddress);
  const appDomain = getDomainFromUrl(appBaseUrl);
  if (fromDomain && appDomain && fromDomain !== appDomain) {
    console.warn(
      `Email domain alignment warning: from domain "${fromDomain}" differs from app domain "${appDomain}".`
    );
  }

  const message = buildCircleCheckInMessage(
    recipientName,
    circleName,
    circleUrl,
    logoUrl,
    unsubscribeUrl
  );

  const day = new Date().toISOString().slice(0, 10);
  const entityRefId = `circle-checkin-${circleId}-${userId || to}-${day}`.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );
  const messageId = makeMessageId(entityRefId, fromDomain);

  if (process.env.RESEND_API_KEY) {
    await sendWithResend({
      to,
      from,
      supportAddress,
      subject: message.subject,
      text: message.text,
      html: message.html,
      listUnsubscribe,
      entityRefId,
      messageId,
      unsubscribeUrl,
    });

    console.log(`📧 Circle check-in sent via Resend to ${to}`);
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
      ...(unsubscribeUrl ? { "X-List-Unsubscribe-URL": unsubscribeUrl } : {}),
    },
    messageId,
  });

  console.log(`📧 Circle check-in sent to ${to}`);
}

export async function sendCircleEntryNotificationEmail(
  to,
  { recipientName, circleName, circleId, actorName, isAnonymous }
) {
  const from = resolveFromAddress();
  assertValidFromAddress(from);
  const supportAddress = process.env.EMAIL_SUPPORT || from;
  const appBaseUrl = (process.env.APP_URL || "https://thegratitudejar.net")
    .replace(/\/$/, "");
  const circleUrl = `${appBaseUrl}/circles/${circleId}`;

  const fromAddress = getFromAddress(from);
  const fromDomain = getDomainFromEmail(fromAddress);
  const appDomain = getDomainFromUrl(appBaseUrl);
  if (fromDomain && appDomain && fromDomain !== appDomain) {
    console.warn(
      `Email domain alignment warning: from domain "${fromDomain}" differs from app domain "${appDomain}".`
    );
  }

  const actorLabel = isAnonymous ? "Someone in your circle" : actorName;
  const subject = `${circleName}: new gratitude shared`;
  const text = `Hi ${recipientName || "there"},

${actorLabel} shared a new gratitude entry in ${circleName}.

Open the circle:
${circleUrl}
`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <p>Hi ${recipientName || "there"},</p>
      <p>${actorLabel} shared a new gratitude entry in <strong>${circleName}</strong>.</p>
      <p>
        <a
          href="${circleUrl}"
          style="
            display:inline-block;
            padding:12px 28px;
            min-width:140px;
            border-radius:999px;
            text-align:center;
            font-weight:600;
            color:#ffffff !important;
            background:#2f80ed;
            background-image:linear-gradient(135deg, #2f80ed, #27ae60);
            text-decoration:none !important;
            border:1px solid #2f80ed;
            box-shadow:0 8px 20px rgba(0,0,0,0.15);
          "
        >
          Open Circle
        </a>
      </p>
      <p style="font-size: 12px; color: #64748b;">
        If the button does not display, use this link:
        <a href="${circleUrl}" style="color:#2f80ed; text-decoration:underline;">${circleUrl}</a>
      </p>
    </div>
  `;

  const entityRefId = `circle-entry-${circleId}-${Date.now()}-${to}`.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );
  const messageId = makeMessageId(entityRefId, fromDomain);

  await sendAppEmail({
    to,
    from,
    supportAddress,
    subject,
    text,
    html,
    entityRefId,
    messageId,
  });
}

export async function sendCircleJoinNotificationEmail(
  to,
  { recipientName, circleName, circleId, joinerName }
) {
  const from = resolveFromAddress();
  assertValidFromAddress(from);
  const supportAddress = process.env.EMAIL_SUPPORT || from;
  const appBaseUrl = (process.env.APP_URL || "https://thegratitudejar.net")
    .replace(/\/$/, "");
  const circleUrl = `${appBaseUrl}/circles/${circleId}`;

  const fromAddress = getFromAddress(from);
  const fromDomain = getDomainFromEmail(fromAddress);
  const appDomain = getDomainFromUrl(appBaseUrl);
  if (fromDomain && appDomain && fromDomain !== appDomain) {
    console.warn(
      `Email domain alignment warning: from domain "${fromDomain}" differs from app domain "${appDomain}".`
    );
  }

  const subject = `${circleName}: a new member joined`;
  const text = `Hi ${recipientName || "there"},

${joinerName} joined ${circleName}.

Open the circle:
${circleUrl}
`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <p>Hi ${recipientName || "there"},</p>
      <p><strong>${joinerName}</strong> joined <strong>${circleName}</strong>.</p>
      <p>
        <a
          href="${circleUrl}"
          style="
            display:inline-block;
            padding:12px 28px;
            min-width:140px;
            border-radius:999px;
            text-align:center;
            font-weight:600;
            color:#ffffff !important;
            background:#2f80ed;
            background-image:linear-gradient(135deg, #2f80ed, #27ae60);
            text-decoration:none !important;
            border:1px solid #2f80ed;
            box-shadow:0 8px 20px rgba(0,0,0,0.15);
          "
        >
          Open Circle
        </a>
      </p>
      <p style="font-size: 12px; color: #64748b;">
        If the button does not display, use this link:
        <a href="${circleUrl}" style="color:#2f80ed; text-decoration:underline;">${circleUrl}</a>
      </p>
    </div>
  `;

  const entityRefId = `circle-join-${circleId}-${Date.now()}-${to}`.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );
  const messageId = makeMessageId(entityRefId, fromDomain);

  await sendAppEmail({
    to,
    from,
    supportAddress,
    subject,
    text,
    html,
    entityRefId,
    messageId,
  });
}

export async function sendAccountVerificationEmail(
  to,
  { recipientName, verifyUrl }
) {
  const from = resolveFromAddress();
  assertValidFromAddress(from);
  const supportAddress = process.env.EMAIL_SUPPORT || from;
  const fromAddress = getFromAddress(from);
  const fromDomain = getDomainFromEmail(fromAddress);

  const subject = "Verify your Gratitude Jar account";
  const text = `Hi ${recipientName || "there"},

Please verify your email to activate your account.

Verify account:
${verifyUrl}
`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <p>Hi ${recipientName || "there"},</p>
      <p>Please verify your email to activate your account.</p>
      <p>
        <a
          href="${verifyUrl}"
          style="
            display:inline-block;
            padding:12px 28px;
            min-width:140px;
            border-radius:999px;
            text-align:center;
            font-weight:600;
            color:#ffffff !important;
            background:#2f80ed;
            background-image:linear-gradient(135deg, #2f80ed, #27ae60);
            text-decoration:none !important;
            border:1px solid #2f80ed;
            box-shadow:0 8px 20px rgba(0,0,0,0.15);
          "
        >
          Verify Email
        </a>
      </p>
      <p style="font-size: 12px; color: #64748b;">
        If the button does not display, use this link:
        <a href="${verifyUrl}" style="color:#2f80ed; text-decoration:underline;">${verifyUrl}</a>
      </p>
    </div>
  `;

  const entityRefId = `verify-email-${Date.now()}-${to}`.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );
  const messageId = makeMessageId(entityRefId, fromDomain);

  await sendAppEmail({
    to,
    from,
    supportAddress,
    subject,
    text,
    html,
    entityRefId,
    messageId,
  });
}

export async function sendEmailChangeVerificationEmail(
  to,
  { recipientName, verifyUrl, currentEmail }
) {
  const from = resolveFromAddress();
  assertValidFromAddress(from);
  const supportAddress = process.env.EMAIL_SUPPORT || from;
  const fromAddress = getFromAddress(from);
  const fromDomain = getDomainFromEmail(fromAddress);

  const subject = "Confirm your new Gratitude Jar email";
  const text = `Hi ${recipientName || "there"},

We received a request to change the email on your Gratitude Jar account${
    currentEmail ? ` (currently ${currentEmail})` : ""
  } to this address.

If this was you, confirm the change:
${verifyUrl}

If you didn't request this, you can ignore this email — your account email will not change.
`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <p>Hi ${recipientName || "there"},</p>
      <p>We received a request to change the email on your Gratitude Jar account${
        currentEmail
          ? ` (currently <strong>${currentEmail}</strong>)`
          : ""
      } to this address.</p>
      <p>If this was you, confirm the change:</p>
      <p>
        <a
          href="${verifyUrl}"
          style="
            display:inline-block;
            padding:12px 28px;
            min-width:140px;
            border-radius:999px;
            text-align:center;
            font-weight:600;
            color:#ffffff !important;
            background:#2f80ed;
            background-image:linear-gradient(135deg, #2f80ed, #27ae60);
            text-decoration:none !important;
            border:1px solid #2f80ed;
            box-shadow:0 8px 20px rgba(0,0,0,0.15);
          "
        >
          Confirm Email Change
        </a>
      </p>
      <p style="font-size: 12px; color: #64748b;">
        If the button does not display, use this link:
        <a href="${verifyUrl}" style="color:#2f80ed; text-decoration:underline;">${verifyUrl}</a>
      </p>
      <p style="font-size: 12px; color: #64748b;">
        If you didn't request this, ignore this email — your account email will not change.
      </p>
    </div>
  `;

  const entityRefId = `change-email-${Date.now()}-${to}`.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );
  const messageId = makeMessageId(entityRefId, fromDomain);

  await sendAppEmail({
    to,
    from,
    supportAddress,
    subject,
    text,
    html,
    entityRefId,
    messageId,
  });
}

export async function sendPasswordResetEmail(to, { recipientName, resetUrl }) {
  const from = resolveFromAddress();
  assertValidFromAddress(from);
  const supportAddress = process.env.EMAIL_SUPPORT || from;
  const fromAddress = getFromAddress(from);
  const fromDomain = getDomainFromEmail(fromAddress);

  const subject = "Reset your Gratitude Jar password";
  const text = `Hi ${recipientName || "there"},

We received a request to reset your password.

Reset password:
${resetUrl}

If you did not request this, you can ignore this email.
`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <p>Hi ${recipientName || "there"},</p>
      <p>We received a request to reset your password.</p>
      <p>
        <a
          href="${resetUrl}"
          style="
            display:inline-block;
            padding:12px 28px;
            min-width:140px;
            border-radius:999px;
            text-align:center;
            font-weight:600;
            color:#ffffff !important;
            background:#2f80ed;
            background-image:linear-gradient(135deg, #2f80ed, #27ae60);
            text-decoration:none !important;
            border:1px solid #2f80ed;
            box-shadow:0 8px 20px rgba(0,0,0,0.15);
          "
        >
          Reset Password
        </a>
      </p>
      <p style="font-size: 12px; color: #64748b;">
        If the button does not display, use this link:
        <a href="${resetUrl}" style="color:#2f80ed; text-decoration:underline;">${resetUrl}</a>
      </p>
      <p style="font-size: 12px; color: #64748b;">
        If you did not request this, you can ignore this email.
      </p>
    </div>
  `;

  const entityRefId = `reset-password-${Date.now()}-${to}`.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );
  const messageId = makeMessageId(entityRefId, fromDomain);

  await sendAppEmail({
    to,
    from,
    supportAddress,
    subject,
    text,
    html,
    entityRefId,
    messageId,
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildFriendDigestMessage({
  recipientName,
  entries,
  appBaseUrl,
  logoUrl,
  unsubscribeUrl,
}) {
  const baseUrl = appBaseUrl.replace(/\/$/, "");
  const feedUrl = `${baseUrl}/feed`;
  const unsubscribeCopy = unsubscribeUrl || baseUrl;

  const textLines = entries.map((entry) => {
    const when = new Date(entry.created_at).toLocaleString();
    const author = entry.author_name || entry.author_email || "A friend";
    const preview = String(entry.content).slice(0, 240);
    return `• ${author} — ${when}\n  ${preview}`;
  });

  const htmlItems = entries
    .map((entry) => {
      const when = new Date(entry.created_at).toLocaleString();
      const author = escapeHtml(
        entry.author_name || entry.author_email || "A friend"
      );
      const preview = escapeHtml(String(entry.content).slice(0, 600));
      const mood = entry.mood ? ` · ${escapeHtml(entry.mood)}` : "";
      return `
        <li style="margin: 0 0 14px 0; padding: 12px 14px; border-radius: 10px; background: #f8fafc;">
          <div style="font-weight: 600; color: #0f172a;">${author}</div>
          <div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">${escapeHtml(
            when
          )}${mood}</div>
          <div style="white-space: pre-wrap; color: #0f172a;">${preview}</div>
        </li>
      `;
    })
    .join("");

  const subject =
    entries.length === 1
      ? `${entries[0].author_name || "A friend"} shared a gratitude`
      : `${entries.length} gratitude posts from people you follow`;

  return {
    subject,
    text: `Hi ${recipientName || "there"},

Here is what people you follow have shared:

${textLines.join("\n\n")}

Open the feed:
${feedUrl}

Unsubscribe:
${unsubscribeCopy}
`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <div style="margin-bottom: 16px;">
          <img src="${logoUrl}" alt="Gratitude Jar" width="72" height="72" style="display:block; width:72px; height:72px; border-radius: 18px;" />
        </div>
        <p>Hi ${escapeHtml(recipientName || "there")},</p>
        <p>Here's what people you follow have shared:</p>
        <ul style="list-style: none; padding: 0; margin: 0 0 18px 0;">
          ${htmlItems}
        </ul>
        <p>
          <a
            href="${feedUrl}"
            style="
              display:inline-block;
              padding:12px 28px;
              min-width:140px;
              border-radius:999px;
              text-align:center;
              font-weight:600;
              color:#ffffff !important;
              background:#2f80ed;
              background-image:linear-gradient(135deg, #2f80ed, #27ae60);
              text-decoration:none !important;
              border:1px solid #2f80ed;
              box-shadow:0 8px 20px rgba(0,0,0,0.15);
            "
          >
            Open the feed
          </a>
        </p>
        <p style="font-size: 12px; color: #64748b;">
          If the button does not display, use this link:
          <a href="${feedUrl}" style="color:#2f80ed; text-decoration:underline;">${feedUrl}</a>
        </p>
        <p style="font-size: 12px; color: #64748b;">
          If you no longer want these digests,
          <a href="${unsubscribeCopy}" style="color:#2f80ed; text-decoration:underline;">unsubscribe</a>.
        </p>
      </div>
    `,
  };
}

export async function sendFriendDigestEmail(
  to,
  { recipientName, userId, entries }
) {
  if (!entries || !entries.length) return;

  assertEmailProviderConfigured();

  const from = resolveFromAddress();
  assertValidFromAddress(from);
  const supportAddress = process.env.EMAIL_SUPPORT || from;
  const supportEmail = getFromAddress(supportAddress) || getFromAddress(from);

  const appBaseUrl = (process.env.APP_URL || "https://thegratitudejar.net")
    .replace(/\/$/, "");
  const apiBaseUrl = (
    process.env.API_URL || "https://gratuity-jar-api.onrender.com"
  ).replace(/\/$/, "");
  const logoUrl = process.env.APP_LOGO_URL || `${appBaseUrl}/logo.png`;

  const unsubscribeToken = createUnsubscribeToken({ userId, email: to });
  const unsubscribeUrl = unsubscribeToken
    ? `${apiBaseUrl}/reminders/unsubscribe?token=${encodeURIComponent(
        unsubscribeToken
      )}`
    : null;
  const listUnsubscribe = unsubscribeUrl
    ? `<mailto:${supportEmail}?subject=unsubscribe>, <${unsubscribeUrl}>`
    : `<mailto:${supportEmail}?subject=unsubscribe>`;

  const message = buildFriendDigestMessage({
    recipientName,
    entries,
    appBaseUrl,
    logoUrl,
    unsubscribeUrl,
  });

  const fromAddress = getFromAddress(from);
  const fromDomain = getDomainFromEmail(fromAddress);

  const day = new Date().toISOString().slice(0, 10);
  const entityRefId = `friend-digest-${userId || to}-${day}`.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );
  const messageId = makeMessageId(entityRefId, fromDomain);

  if (process.env.RESEND_API_KEY) {
    await sendWithResend({
      to,
      from,
      supportAddress,
      subject: message.subject,
      text: message.text,
      html: message.html,
      listUnsubscribe,
      entityRefId,
      messageId,
      unsubscribeUrl,
    });
    console.log(`📧 Friend digest sent via Resend to ${to}`);
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
      ...(unsubscribeUrl ? { "X-List-Unsubscribe-URL": unsubscribeUrl } : {}),
    },
    messageId,
  });
  console.log(`📧 Friend digest sent to ${to}`);
}

export async function sendNewFollowerEmail(
  to,
  { recipientName, recipientUserId, followerName, followerEmail }
) {
  assertEmailProviderConfigured();

  const from = resolveFromAddress();
  assertValidFromAddress(from);
  const supportAddress = process.env.EMAIL_SUPPORT || from;
  const supportEmail = getFromAddress(supportAddress) || getFromAddress(from);

  const appBaseUrl = (process.env.APP_URL || "https://thegratitudejar.net")
    .replace(/\/$/, "");
  const apiBaseUrl = (
    process.env.API_URL || "https://gratuity-jar-api.onrender.com"
  ).replace(/\/$/, "");
  const logoUrl = process.env.APP_LOGO_URL || `${appBaseUrl}/logo.png`;
  const friendsUrl = `${appBaseUrl}/friends`;

  const unsubscribeToken = createUnsubscribeToken({
    userId: recipientUserId,
    email: to,
  });
  const unsubscribeUrl = unsubscribeToken
    ? `${apiBaseUrl}/reminders/unsubscribe?token=${encodeURIComponent(
        unsubscribeToken
      )}`
    : null;
  const listUnsubscribe = unsubscribeUrl
    ? `<mailto:${supportEmail}?subject=unsubscribe>, <${unsubscribeUrl}>`
    : `<mailto:${supportEmail}?subject=unsubscribe>`;

  const followerDisplay = followerName || followerEmail || "Someone";
  const subject = `${followerDisplay} started following you on Gratitude Jar`;
  const unsubscribeCopy = unsubscribeUrl || friendsUrl;

  const text = `Hi ${recipientName || "there"},

${followerDisplay} just followed you on Gratitude Jar.

When you post a gratitude entry set to Friends or Public, they'll see it in their daily digest.

Open your friends page:
${friendsUrl}

Unsubscribe:
${unsubscribeCopy}
`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <div style="margin-bottom: 16px;">
        <img src="${logoUrl}" alt="Gratitude Jar" width="72" height="72" style="display:block; width:72px; height:72px; border-radius: 18px;" />
      </div>
      <p>Hi ${escapeHtml(recipientName || "there")},</p>
      <p style="margin: 12px 0 10px 0; font-size: 18px; font-weight: 700;">
        ${escapeHtml(followerDisplay)} just followed you.
      </p>
      <p>When you post a gratitude entry set to <strong>Friends</strong> or <strong>Public</strong>, they'll see it in their daily digest.</p>
      <p>
        <a
          href="${friendsUrl}"
          style="
            display:inline-block;
            padding:12px 28px;
            min-width:140px;
            border-radius:999px;
            text-align:center;
            font-weight:600;
            color:#ffffff !important;
            background:#2f80ed;
            background-image:linear-gradient(135deg, #2f80ed, #27ae60);
            text-decoration:none !important;
            border:1px solid #2f80ed;
            box-shadow:0 8px 20px rgba(0,0,0,0.15);
          "
        >
          Open friends
        </a>
      </p>
      <p style="font-size: 12px; color: #64748b;">
        If the button does not display, use this link:
        <a href="${friendsUrl}" style="color:#2f80ed; text-decoration:underline;">${friendsUrl}</a>
      </p>
      <p style="font-size: 12px; color: #64748b;">
        If you no longer want these notifications,
        <a href="${unsubscribeCopy}" style="color:#2f80ed; text-decoration:underline;">unsubscribe</a>.
      </p>
    </div>
  `;

  const fromAddress = getFromAddress(from);
  const fromDomain = getDomainFromEmail(fromAddress);

  const entityRefId = `new-follower-${recipientUserId || to}-${Date.now()}`.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );
  const messageId = makeMessageId(entityRefId, fromDomain);

  if (process.env.RESEND_API_KEY) {
    await sendWithResend({
      to,
      from,
      supportAddress,
      subject,
      text,
      html,
      listUnsubscribe,
      entityRefId,
      messageId,
      unsubscribeUrl,
    });
    console.log(`📧 New-follower email sent via Resend to ${to}`);
    return;
  }

  await transporter.sendMail({
    from,
    to,
    replyTo: supportAddress,
    subject,
    text,
    html,
    headers: {
      "List-Unsubscribe": listUnsubscribe,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      "X-Entity-Ref-ID": entityRefId,
      ...(unsubscribeUrl ? { "X-List-Unsubscribe-URL": unsubscribeUrl } : {}),
    },
    messageId,
  });
  console.log(`📧 New-follower email sent to ${to}`);
}

export async function sendFollowRequestEmail(
  to,
  { recipientName, recipientUserId, requesterName, requesterEmail }
) {
  assertEmailProviderConfigured();

  const from = resolveFromAddress();
  assertValidFromAddress(from);
  const supportAddress = process.env.EMAIL_SUPPORT || from;
  const supportEmail = getFromAddress(supportAddress) || getFromAddress(from);

  const appBaseUrl = (process.env.APP_URL || "https://thegratitudejar.net").replace(/\/$/, "");
  const apiBaseUrl = (
    process.env.API_URL || "https://gratuity-jar-api.onrender.com"
  ).replace(/\/$/, "");
  const logoUrl = process.env.APP_LOGO_URL || `${appBaseUrl}/logo.png`;
  const friendsUrl = `${appBaseUrl}/friends`;

  const unsubscribeToken = createUnsubscribeToken({
    userId: recipientUserId,
    email: to,
  });
  const unsubscribeUrl = unsubscribeToken
    ? `${apiBaseUrl}/reminders/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`
    : null;
  const listUnsubscribe = unsubscribeUrl
    ? `<mailto:${supportEmail}?subject=unsubscribe>, <${unsubscribeUrl}>`
    : `<mailto:${supportEmail}?subject=unsubscribe>`;

  const requesterDisplay = requesterName || requesterEmail || "Someone";
  const subject = `${requesterDisplay} wants to follow you on Gratitude Jar`;
  const unsubscribeCopy = unsubscribeUrl || friendsUrl;

  const text = `Hi ${recipientName || "there"},

${requesterDisplay} requested to follow you on Gratitude Jar.

Open your friends page to accept or deny:
${friendsUrl}

Unsubscribe:
${unsubscribeCopy}
`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <div style="margin-bottom: 16px;">
        <img src="${logoUrl}" alt="Gratitude Jar" width="72" height="72" style="display:block; width:72px; height:72px; border-radius: 18px;" />
      </div>
      <p>Hi ${escapeHtml(recipientName || "there")},</p>
      <p style="margin: 12px 0 10px 0; font-size: 18px; font-weight: 700;">
        ${escapeHtml(requesterDisplay)} wants to follow you.
      </p>
      <p>Approve or deny on your friends page.</p>
      <p>
        <a
          href="${friendsUrl}"
          style="
            display:inline-block;
            padding:12px 28px;
            min-width:140px;
            border-radius:999px;
            text-align:center;
            font-weight:600;
            color:#ffffff !important;
            background:#2f80ed;
            background-image:linear-gradient(135deg, #2f80ed, #27ae60);
            text-decoration:none !important;
            border:1px solid #2f80ed;
            box-shadow:0 8px 20px rgba(0,0,0,0.15);
          "
        >
          Review request
        </a>
      </p>
      <p style="font-size: 12px; color: #64748b;">
        If the button does not display, use this link:
        <a href="${friendsUrl}" style="color:#2f80ed; text-decoration:underline;">${friendsUrl}</a>
      </p>
      <p style="font-size: 12px; color: #64748b;">
        If you no longer want these notifications,
        <a href="${unsubscribeCopy}" style="color:#2f80ed; text-decoration:underline;">unsubscribe</a>.
      </p>
    </div>
  `;

  const fromAddress = getFromAddress(from);
  const fromDomain = getDomainFromEmail(fromAddress);
  const entityRefId = `follow-request-${recipientUserId || to}-${Date.now()}`.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );
  const messageId = makeMessageId(entityRefId, fromDomain);

  if (process.env.RESEND_API_KEY) {
    await sendWithResend({
      to,
      from,
      supportAddress,
      subject,
      text,
      html,
      listUnsubscribe,
      entityRefId,
      messageId,
      unsubscribeUrl,
    });
    console.log(`📧 Follow-request email sent via Resend to ${to}`);
    return;
  }

  await transporter.sendMail({
    from,
    to,
    replyTo: supportAddress,
    subject,
    text,
    html,
    headers: {
      "List-Unsubscribe": listUnsubscribe,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      "X-Entity-Ref-ID": entityRefId,
      ...(unsubscribeUrl ? { "X-List-Unsubscribe-URL": unsubscribeUrl } : {}),
    },
    messageId,
  });
  console.log(`📧 Follow-request email sent to ${to}`);
}

export async function sendFriendInviteEmail(
  to,
  { inviterName, inviterEmail, inviteUrl }
) {
  assertEmailProviderConfigured();

  const from = resolveFromAddress();
  assertValidFromAddress(from);
  const supportAddress = process.env.EMAIL_SUPPORT || from;

  const appBaseUrl = (process.env.APP_URL || "https://thegratitudejar.net").replace(/\/$/, "");
  const logoUrl = process.env.APP_LOGO_URL || `${appBaseUrl}/logo.png`;

  const inviterDisplay = inviterName || inviterEmail || "Your friend";
  const subject = `${inviterDisplay} invited you to Gratitude Jar`;

  const text = `${inviterDisplay} thinks you'd like Gratitude Jar — a small place to share what you're grateful for.

Join with this link:
${inviteUrl}

Hope to see you there.
`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <div style="margin-bottom: 16px;">
        <img src="${logoUrl}" alt="Gratitude Jar" width="72" height="72" style="display:block; width:72px; height:72px; border-radius: 18px;" />
      </div>
      <p style="margin: 12px 0 10px 0; font-size: 18px; font-weight: 700;">
        ${escapeHtml(inviterDisplay)} invited you to Gratitude Jar.
      </p>
      <p>Gratitude Jar is a small, quiet place to share moments you're grateful for — and see what others are too.</p>
      <p>
        <a
          href="${inviteUrl}"
          style="
            display:inline-block;
            padding:12px 28px;
            min-width:140px;
            border-radius:999px;
            text-align:center;
            font-weight:600;
            color:#ffffff !important;
            background:#2f80ed;
            background-image:linear-gradient(135deg, #2f80ed, #27ae60);
            text-decoration:none !important;
            border:1px solid #2f80ed;
            box-shadow:0 8px 20px rgba(0,0,0,0.15);
          "
        >
          Join Gratitude Jar
        </a>
      </p>
      <p style="font-size: 12px; color: #64748b;">
        Or paste this link in your browser:
        <a href="${inviteUrl}" style="color:#2f80ed; text-decoration:underline;">${inviteUrl}</a>
      </p>
    </div>
  `;

  const fromAddress = getFromAddress(from);
  const fromDomain = getDomainFromEmail(fromAddress);
  const entityRefId = `friend-invite-${Date.now()}-${to}`.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );
  const messageId = makeMessageId(entityRefId, fromDomain);

  if (process.env.RESEND_API_KEY) {
    await sendWithResend({
      to,
      from,
      supportAddress,
      subject,
      text,
      html,
      entityRefId,
      messageId,
    });
    console.log(`📧 Friend-invite email sent via Resend to ${to}`);
    return;
  }

  await transporter.sendMail({
    from,
    to,
    replyTo: supportAddress,
    subject,
    text,
    html,
    headers: {
      "X-Entity-Ref-ID": entityRefId,
    },
    messageId,
  });
  console.log(`📧 Friend-invite email sent to ${to}`);
}
