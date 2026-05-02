import pool from "./index.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dayKey(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD in UTC
}

function daysBetween(earlierKey, laterKey) {
  const a = new Date(`${earlierKey}T00:00:00Z`).getTime();
  const b = new Date(`${laterKey}T00:00:00Z`).getTime();
  return Math.round((b - a) / MS_PER_DAY);
}

export async function computeStreak(userId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT (created_at AT TIME ZONE 'UTC')::date AS day
     FROM gratitude_entries
     WHERE user_id = $1
     ORDER BY day DESC`,
    [userId]
  );

  if (rows.length === 0) {
    return { current: 0, longest: 0, last_post_date: null };
  }

  const days = rows.map((r) =>
    r.day instanceof Date ? dayKey(r.day) : String(r.day)
  );

  const today = dayKey(new Date());

  // Current streak with one freeze day allowed per streak.
  // - Most recent post must be today, yesterday, or 2 days ago (uses freeze).
  // - Walking backward, gap=1 always counts; one gap=2 is allowed (freeze used).
  // - Any further gap=2 or gap>2 breaks the streak.
  let current = 0;
  let freezeUsed = false;
  const gapToToday = daysBetween(days[0], today);
  if (gapToToday <= 2) {
    if (gapToToday === 2) freezeUsed = true;
    current = 1;
    for (let i = 1; i < days.length; i++) {
      const gap = daysBetween(days[i], days[i - 1]);
      if (gap === 1) {
        current++;
      } else if (gap === 2 && !freezeUsed) {
        current++;
        freezeUsed = true;
      } else {
        break;
      }
    }
  }

  // Longest streak: longest consecutive run anywhere in history.
  let longest = 0;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (daysBetween(days[i], days[i - 1]) === 1) {
      run++;
    } else {
      if (run > longest) longest = run;
      run = 1;
    }
  }
  if (run > longest) longest = run;
  if (current > longest) longest = current;

  return {
    current,
    longest,
    last_post_date: days[0],
    freeze_used: freezeUsed,
    freeze_available: current > 0 && !freezeUsed,
  };
}
