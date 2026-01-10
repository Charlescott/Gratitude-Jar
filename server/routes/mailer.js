import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendReminderEmail(to, name) {
  await transporter.sendMail({
    from: `"Gratitude Jar" <hello@gratitudejar.com>`,
    to,
    subject: "Your Gratitude Reminder",
    text: `Hi ${name},

It's time to add a gratitude entry.

Visit:
https://thegratuityjar.com/

— Gratitude Jar`,
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.6;">
        <h2 style="color:#ff7f50;">Hi ${name} 🌱</h2>

        <p>It’s time to add a gratitude entry.</p>

        <a href="https://gratuityjar.com/entries"
           style="
             display:inline-block;
             margin-top:16px;
             padding:12px 20px;
             background:#ff7f50;
             color:white;
             text-decoration:none;
             border-radius:999px;
             font-weight:600;
           ">
          Open Gratitude Jar
        </a>

        <p style="margin-top:24px; font-size:0.85rem; color:#64748b;">
          You’re receiving this because you enabled reminders.
        </p>
      </div>
    `,
  });

  console.log(`📧 Reminder sent to ${to}`);
}
