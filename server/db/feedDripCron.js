import cron from "node-cron";
import pool from "./index.js";

const SEED_DOMAIN = "gratitudedemo.local";

// Daily volume: 1 or 2 posts per UTC day. Active window keeps posts in
// daylight-ish hours so the feed feels alive when humans are awake.
const ACTIVE_HOUR_START_UTC = 8;
const ACTIVE_HOUR_END_UTC = 22;
const ANON_RATIO = 0.12;
const MOOD_RATIO = 0.7;

const MOODS = [
  "happy", "calm", "grateful", "blessed", "inspired", "loved", "hopeful",
  "peaceful", "thankful", "joyful", "content", "uplifted", "cherished",
];

// Fresh pool — distinct from server/db/seedDemo.js so we don't hit unique-content
// collisions and the feed keeps gaining new voices over time.
const DRIP_POSTS = [
  "Sat on the porch with a coffee that was too hot. Watched the neighborhood wake up. No phone. Best 20 minutes of my week.",
  "Caught my reflection in a window today and didn't immediately critique it. That's growth.",
  "Found my mom's handwriting on an old grocery list in a coat pocket. Stood in the kitchen for a while.",
  "Bus driver waited for me when I was running. Smiled like he wasn't doing me any favor at all.",
  "Coworker brought in donuts because she 'felt like it.' That's the whole story. Just kindness for no reason.",
  "First time my plant flowered. I know it's small. I'm choosing to be proud anyway.",
  "Walked the dog at sunrise. Saw exactly three other people. We all nodded. A little secret club.",
  "Husband loaded the dishwasher correctly without being asked. Marriage is built on these small miracles.",
  "Made it through a whole therapy session without crying. Then cried in the car after. Both feel like progress.",
  "Old neighbor brought over zucchini from her garden. I don't even like zucchini. I love that she thought of me.",
  "Niece called to ask how to make rice. I felt useful in a way I forgot I could.",
  "The new barista remembered I take oat milk. I'm a regular somewhere. That's a kind of belonging.",
  "Repaired the fence with my dad. Mostly we didn't talk. It was perfect.",
  "Finished the book that had been on my nightstand for two years. The ending was worth the wait.",
  "Found a feather on the trail that looked like a paintbrush. Brought it home. It's on my desk now.",
  "Boss told me to take the afternoon off. Didn't even argue. Drove to the lake and stared at it.",
  "Aunt's lasagna recipe finally turned out right. Three failed attempts. Worth it.",
  "Heard a kid laugh on the train. The kind from the belly. Whole car softened for a second.",
  "Cleaned out the closet. Donated four bags. Apartment is breathing again.",
  "First date in two years and it was easy. Just easy. Forgot that was possible.",
  "Got the all-clear from the dentist. Walked out feeling like a kid leaving school for summer.",
  "Wrote a letter by hand. Sealed it. Walked it to the mailbox. It felt important somehow.",
  "Roommate left a note on the fridge that said 'thinking of you, have a good day.' Three years living together. Still.",
  "Took the scenic route home for no reason. Found a little bookstore I never knew existed.",
  "My therapist said something today that's going to live in my head for a while. The good kind.",
  "Daughter wrote her name for the first time. Backwards. I'm framing it.",
  "Made it to the gym three times this week. Last week was zero. I'm not behind, I'm starting.",
  "Found the perfect avocado. Just one. The universe was kind today.",
  "Train was delayed and I read fifty pages I would not have read otherwise. Net positive.",
  "Stranger complimented my jacket. I bought it secondhand. The compliment felt earned somehow.",
  "Old college friend sent me a song with a note that said 'this is you.' She nailed it.",
  "First successful loaf of sourdough. Six months of failures. The crust cracked properly.",
  "Saw a rainbow on the drive home. Pulled over. Just looked at it for a minute.",
  "Got the rejection but the recruiter was kind about it. That mattered more than I expected.",
  "Went to bed at 9 pm on a Friday. No guilt. Best decision of my month.",
  "Babysat my nephew. He fell asleep on my chest. I didn't move for an hour.",
  "Watched a thunderstorm roll in over the field. Power went out. Lit candles. Best night.",
  "Made my grandfather's chili. Smelled exactly like his kitchen. He's been gone six years.",
  "Found a parking meter with 47 minutes still on it. Tipped my hat to the previous driver.",
  "Wrote a difficult email I'd been avoiding for weeks. Hit send. The world didn't end.",
  "Sister sent me a voice note instead of a text. Got to hear her laugh. Worth more than ten pages.",
  "Asked for help today. It was hard. They said yes immediately. Why do I forget that part.",
  "Had a really good cry in the shower. Felt rinsed in more ways than one.",
  "Daughter said 'I love you' before I said it first. She's three. Knocked the wind out of me.",
  "Tried something new on the menu. It was great. I'm tired of always ordering the same thing.",
  "Got home before the rain. Felt like I'd outrun something.",
  "Received a thank-you card in the mail. Real paper. Real ink. I read it three times.",
  "My team backed me up in a meeting today. Didn't realize how much I needed that.",
  "Ate dinner outside for the first time this year. The light was that golden hour kind.",
  "Saw a turtle crossing the road and helped it across. Felt like a small victory for everyone involved.",
  "Mom taught me how to deglaze a pan over FaceTime. Best cooking lesson of my life.",
  "Took my coffee to the park instead of my desk. The work still got done. The morning was better.",
  "Old dog is still here. Still wagging. Every day is bonus from here.",
  "Bought a notebook I don't need because the cover made me happy. Sometimes that's enough reason.",
  "First swim of the summer. Cold. Brilliant. Felt like a reset.",
  "Friend's kid called me 'aunt' for the first time. Didn't correct her. Don't want to.",
  "Cooked dinner from scratch on a weeknight. Set the table. We even lit a candle. It was Tuesday.",
  "Heard my favorite song on the radio at exactly the right moment. The universe shows off sometimes.",
  "Walked instead of drove. The errand took forty extra minutes. The day was better for it.",
  "Got lost in a sketchbook for two hours. Forgot lunch. Forgot my phone. Found something else.",
  "Three of us sat in the kitchen until midnight just talking. No agenda. No phones. Old-school.",
  "Picked up litter on my walk today. Small thing. Felt like a love letter to the neighborhood.",
  "Went to a yoga class alone for the first time. Cried in savasana. Stayed after to thank the teacher.",
  "Got promoted to a job I didn't apply for. They came to me. Still processing. In a good way.",
  "Made a stranger laugh at the post office. Whole line softened. Worth the wait.",
  "Watched my partner cook with the radio on, dancing a little. Didn't say anything. Just watched.",
  "Slept eight hours for the first time in weeks. Woke up actually rested. Miracle.",
  "Found my middle-school journal in a box. Younger me was tougher than I remembered. Owe her one.",
  "Wrote down five things at the end of the day. Tiny things. Felt taller for it.",
  "Friend remembered something I told her months ago. Felt fully seen.",
  "Bought myself the good cheese. No occasion. Ate it standing at the counter.",
  "Caught the moonrise over the trees on the way home. Pulled over again. Worth it again.",
  "Got the kids out the door without yelling. Counting it.",
  "Had a hard day and didn't doom-scroll. Made tea instead. Read a chapter. Slept.",
  "Made eye contact with a baby on the bus. We grinned at each other for ten stops.",
  "Took the dog to the dog park. Watched her have the best fifteen minutes of her week.",
  "Got the offer. Still in shock. Going to celebrate quietly with a glass of wine and the cat.",
  "Brother sent me a meme that was so specific to us it made me laugh out loud at the dentist.",
  "Walked the long way home through the park. Saw tulips just starting to open. Spring is on its way.",
  "First time I cooked the family recipe and got it right. Texted Grandma a photo. She wrote back: 'now you have it forever.'",
  "Stopped at the lookout instead of driving past it. Five minutes of silence over the valley. Felt like church.",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

let schemaReady = null;
async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS seed_drip_state (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        plan_date DATE,
        next_times TIMESTAMPTZ[] NOT NULL DEFAULT '{}'::timestamptz[]
      )
    `).then(() =>
      pool.query(
        `INSERT INTO seed_drip_state (id) VALUES (1) ON CONFLICT DO NOTHING`
      )
    );
  }
  await schemaReady;
}

function planForToday() {
  // 50/50 split between 1 and 2 posts per day.
  const count = Math.random() < 0.5 ? 1 : 2;
  const today = new Date();
  const times = [];
  for (let i = 0; i < count; i++) {
    const hour =
      ACTIVE_HOUR_START_UTC +
      Math.floor(Math.random() * (ACTIVE_HOUR_END_UTC - ACTIVE_HOUR_START_UTC));
    const minute = Math.floor(Math.random() * 60);
    const t = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
        hour,
        minute,
        0
      )
    );
    times.push(t);
  }
  return times.sort((a, b) => a - b);
}

async function refreshPlanIfNewDay() {
  const { rows } = await pool.query(
    `SELECT plan_date, (NOW() AT TIME ZONE 'UTC')::date AS today
     FROM seed_drip_state WHERE id = 1`
  );
  const row = rows[0];
  const planned = row?.plan_date?.getTime?.();
  const today = row?.today?.getTime?.();
  if (planned && today && planned === today) return;

  const times = planForToday();
  await pool.query(
    `UPDATE seed_drip_state
       SET plan_date = (NOW() AT TIME ZONE 'UTC')::date,
           next_times = $1::timestamptz[]
     WHERE id = 1`,
    [times.map((t) => t.toISOString())]
  );
  console.log(
    `[feed-drip] planned ${times.length} post(s) for today: ${times
      .map((t) => t.toISOString())
      .join(", ")}`
  );
}

async function maybePost() {
  const { rows } = await pool.query(
    `SELECT next_times FROM seed_drip_state WHERE id = 1`
  );
  const all = (rows[0]?.next_times || []).map((t) => new Date(t));
  if (all.length === 0) return;
  const now = new Date();
  const due = all.filter((t) => t <= now);
  if (due.length === 0) return;
  const remaining = all.filter((t) => t > now);

  const usersRes = await pool.query(
    `SELECT id FROM users WHERE email LIKE $1`,
    [`%@${SEED_DOMAIN}`]
  );
  const userIds = usersRes.rows.map((r) => r.id);
  if (userIds.length === 0) {
    console.warn("[feed-drip] no seed users found; clearing due slots");
    await pool.query(
      `UPDATE seed_drip_state SET next_times = $1::timestamptz[] WHERE id = 1`,
      [remaining.map((t) => t.toISOString())]
    );
    return;
  }

  // Avoid posting bodies that are already in the DB.
  const usedRes = await pool.query(
    `SELECT content FROM gratitude_entries WHERE content = ANY($1::text[])`,
    [DRIP_POSTS]
  );
  const used = new Set(usedRes.rows.map((r) => r.content));
  const available = DRIP_POSTS.filter((p) => !used.has(p));
  const pickPool = available.length > 0 ? available : DRIP_POSTS;

  for (let i = 0; i < due.length; i++) {
    const userId = pick(userIds);
    const body = pick(pickPool);
    const mood = Math.random() < MOOD_RATIO ? pick(MOODS) : null;
    const isAnonymous = Math.random() < ANON_RATIO;
    await pool.query(
      `INSERT INTO gratitude_entries
         (user_id, content, mood, visibility, is_anonymous)
       VALUES ($1, $2, $3, 'public', $4)`,
      [userId, body, mood, isAnonymous]
    );
    console.log(`[feed-drip] posted entry from user ${userId}`);
  }

  await pool.query(
    `UPDATE seed_drip_state SET next_times = $1::timestamptz[] WHERE id = 1`,
    [remaining.map((t) => t.toISOString())]
  );
}

async function tick() {
  try {
    await ensureSchema();
    await refreshPlanIfNewDay();
    await maybePost();
  } catch (err) {
    console.error("[feed-drip] tick failed:", err);
  }
}

let started = false;
export function scheduleFeedDrip() {
  if (started) return;
  started = true;

  // Initial tick a few seconds after boot so any pending fires from a
  // restart aren't delayed until the first cron interval.
  setTimeout(tick, 8_000);

  // Every five minutes — fine-grained enough that drift from the planned
  // time is at most a few minutes, cheap enough to ignore.
  cron.schedule("*/5 * * * *", tick);
}
