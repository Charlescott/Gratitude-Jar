// db/seed.js
import pool from "./index.js";

async function seed() {
  console.log("🌱 Starting database seeding...");

  try {
    // Start transaction
    await pool.query("BEGIN");

    // Delete existing data in the correct order
    await pool.query("DELETE FROM user_reminders");
    await pool.query("DELETE FROM gratitude_entries");
    await pool.query("DELETE FROM users");

    console.log("🧹 Cleared existing data.");

    // Insert users
    const { rows: users } = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES
         ('Alice', 'alice@example.com', 'password123'),
         ('Bob', 'bob@example.com', 'password123')
       RETURNING id, name`
    );

    console.log("👤 Inserted users:", users);

    // Insert gratitude entries
    const entries = [
      {
        user_id: users[0].id,
        content: "Grateful for sunny days 🌞",
        mood: "happy",
      },
      {
        user_id: users[0].id,
        content: "Grateful for my morning coffee ☕",
        mood: "neutral",
      },
      {
        user_id: users[1].id,
        content: "Grateful for my family ❤️",
        mood: "grateful",
      },
    ];

    for (const entry of entries) {
      await pool.query(
        `INSERT INTO gratitude_entries (user_id, content, mood, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [entry.user_id, entry.content, entry.mood]
      );
    }

    console.log("📖 Inserted sample gratitude entries.");

    await pool.query(
      `INSERT INTO user_reminders (user_id, frequency, time_of_day, active)
       VALUES
         ($1, 'daily', '09:00'::time, true),
         ($2, 'weekly', '10:30'::time, true)`,
      [users[0].id, users[1].id]
    );

    console.log("⏰ Inserted test reminders.");

    await pool.query("COMMIT");

    console.log("✅ Database seeding complete!");
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("❌ Seeding error:", err);
  } finally {
    await pool.end();
    console.log("🔌 Connection closed.");
  }
}

seed();
