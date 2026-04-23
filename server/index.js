import "./loadEnv.js"; // MUST be first — loads env before any module reads process.env
import express from "express";
import cors from "cors";
import pool from "./db/index.js";
import questionsRouter from "./routes/questions.js";
import authRouter from "./routes/auth.js";
import entriesRouter from "./routes/entries.js";
import { scheduleReminders } from "./db/reminderCron.js";
import remindersRouter from "./routes/reminders.js";
import circlesRouter from "./routes/circles.js";
import adminRouter from "./routes/admin.js";
import followsRouter from "./routes/follows.js";
import notificationsRouter from "./routes/notifications.js";
import feedRouter from "./routes/feed.js";
import ensureSocialSchema from "./db/ensureSocialSchema.js";
import ensureNotificationsSchema from "./db/ensureNotificationsSchema.js";
import ensureFeedSchema from "./db/ensureFeedSchema.js";

console.log("R2 configured?", {
  hasAccount: !!process.env.R2_ACCOUNT_ID,
  hasKey: !!process.env.R2_ACCESS_KEY_ID,
  hasSecret: !!process.env.R2_SECRET_ACCESS_KEY,
  hasBucket: !!process.env.R2_BUCKET,
  hasPublic: !!process.env.R2_PUBLIC_BASE_URL,
});

const app = express();

app.use(cors());
app.use(express.json());
app.use("/reminders", remindersRouter);
app.use("/circles", circlesRouter);
app.use("/follows", followsRouter);
app.use("/notifications", notificationsRouter);
app.use("/feed", feedRouter);

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("Error connecting to the database:", err);
  } else {
    console.log("Database connected:", res.rows[0]);
  }
});

app.get("/", (req, res) => {
  res.send("Gratitude Jar Server is running");
});

console.log("DB HOST:", process.env.DB_HOST);
console.log("DATABASE_URL:", process.env.DATABASE_URL);

app.use("/auth", authRouter);
app.use("/questions", questionsRouter);
app.use("/entries", entriesRouter);
app.use("/admin", adminRouter);

const PORT = process.env.PORT || 5000;

ensureSocialSchema(pool).catch((err) =>
  console.error("ensureSocialSchema error:", err)
);
ensureNotificationsSchema(pool).catch((err) =>
  console.error("ensureNotificationsSchema error:", err)
);
ensureFeedSchema(pool).catch((err) =>
  console.error("ensureFeedSchema error:", err)
);

scheduleReminders();
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

pool.query("SELECT current_database()", (err, res) => {
  console.log("Connected DB:", res?.rows[0]?.current_database);
});
