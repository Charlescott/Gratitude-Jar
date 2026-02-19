import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function buildReminderMessage(name) {
  return {
    subject: "Gratitude reminder",
    text: `Hi ${name},

This is your reminder to add a gratitude entry.

Open your journal:
https://thegratuityjar.com/entries

If you no longer want reminders, turn them off in your account settings.
`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <p>Hi ${name},</p>
        <p>This is your reminder to add a gratitude entry.</p>
        <p>
          <a href="https://thegratuityjar.com/entries">Open your journal</a>
        </p>
        <p style="font-size: 12px; color: #64748b;">
          If you no longer want reminders, turn them off in your account settings.
        </p>
      </div>
    `,
  };
}

async function sendWithResend({ to, from, subject, text, html, listUnsubscribe }) {
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
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend send failed: ${response.status} ${body}`);
  }
}

export async function sendReminderEmail(to, name) {
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const supportAddress = process.env.EMAIL_SUPPORT || from;
  const appBaseUrl = process.env.APP_URL || "https://thegratuityjar.com";
  const listUnsubscribe = `<mailto:${supportAddress}?subject=unsubscribe>, <${appBaseUrl}/reminders>`;
  const message = buildReminderMessage(name);

  if (process.env.RESEND_API_KEY) {
    await sendWithResend({
      to,
      from,
      subject: message.subject,
      text: message.text,
      html: message.html,
      listUnsubscribe,
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
    },
  });

  console.log(`📧 Reminder sent to ${to}`);
}
