import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db/index.js";
import questionsRouter from "./routes/questions.js";
import authRouter from "./routes/auth.js";
import entriesRouter from "./routes/entries.js";
import { scheduleReminders } from "./db/reminderCron.js"

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("Error connecting to the database:", err);
  } else {
    console.log("Database connected:", res.rows[0]);
  }
});

app.get("/", (req, res) => {
  res.send("Gratuity Jar Server is running");
});

app.use("/auth", authRouter);
app.use("/questions", questionsRouter);
app.use("/entries", entriesRouter);

const PORT = process.env.PORT || 5000;

scheduleReminders();
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
