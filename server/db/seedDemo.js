import "../loadEnv.js";
import bcrypt from "bcrypt";
import pool from "./index.js";

const SEED_DOMAIN = "gratitudedemo.local";
const PASSWORD = "demo-password";
const NUM_USERS = 30;
const NUM_POSTS = 50;
const AVATAR_RATIO = 0.7; // 70% of users get a profile picture
const ANON_RATIO = 0.12;
const MOOD_RATIO = 0.7;
const MAX_AGE_DAYS = 30;

const FIRST_NAMES = [
  "Maya", "Jordan", "Leila", "Diego", "Aisha", "Nico", "Priya", "Ethan",
  "Sofia", "Marcus", "Hana", "Theo", "Ines", "Daniel", "Yara", "Owen",
  "Kira", "Andre", "Mei", "Sam", "Noor", "Felix", "Tess", "Kenji",
  "Lola", "Rafa", "Nadia", "Asher", "Camille", "Kai", "Imani", "Bea",
];

const LAST_NAMES = [
  "Okafor", "Patel", "Rivera", "Hayes", "Nguyen", "Sundström", "Almeida",
  "Cohen", "Park", "Bennett", "Tanaka", "Mendoza", "Ó'Brien", "Kowalski",
  "Hassan", "Singh", "Reyes", "Schmidt", "Khoury", "Walsh", "Torres",
  "Lindgren", "Davies", "Castillo", "Ito", "Brennan", "Larsen", "Gomez",
];

const MOODS = [
  "happy", "calm", "grateful", "blessed", "inspired", "loved", "hopeful",
  "peaceful", "thankful", "joyful", "content", "uplifted", "cherished",
];

const POSTS = [
  "Made it to the farmer's market before the rain. Walked home with a bag of plums and the smell of basil on my hands. Small wins.",
  "My daughter learned to whistle today. She's been at it for weeks. We celebrated with grilled cheese and tomato soup.",
  "Coworker covered my shift so I could see my mom. Didn't ask for anything in return. I'll never forget that.",
  "First morning run since the surgery. Slow, but I made it to the end of the block and back. Didn't think I'd be here a year ago.",
  "The library let me keep an overdue book three extra weeks because I told them my dog was sick. Librarians are the best people on earth.",
  "Quiet rainy Sunday. Coffee, an old book, no phone. I forgot how good silence sounds.",
  "Got a postcard from a friend I haven't seen since college. Just three lines. It made my whole week.",
  "Three years sober today. Still hard. Still worth it.",
  "Found a parking spot RIGHT in front of the grocery store. In the rain. With ten minutes to spare. The universe is kind sometimes.",
  "My grandma sent me her chili recipe in her handwriting. I'm gonna frame the recipe card after I make it.",
  "Cat curled up on my chest while I was reading. Didn't move for two hours. Got nothing done. Worth every minute.",
  "Stranger held the elevator for me when I was juggling boxes. We didn't say a word but he saw me. That's enough.",
  "Promotion came through. Crying a little. Five years of grinding feels lighter now.",
  "Sunset on the back porch with a glass of wine. The dog is snoring. This is the good stuff.",
  "My team finally pushed the migration after six weeks. Going to sleep for approximately 14 hours.",
  "Watched my kid try a vegetable without making a face. Today is a good day.",
  "Spotted a heron at the pond on my walk. Stood still and watched me for almost a minute before flying off. Felt like a gift.",
  "Therapist said I sounded different today. Lighter. I think she's right.",
  "Mom called just to say she was thinking of me. No reason. Just love. I'm gonna call her back tonight.",
  "Finished the puzzle that has been sitting on my dining table for two months. The cat tried to help. Mostly just laid on it.",
  "Good news: blood work came back clean. Letting myself exhale.",
  "Kids made me breakfast in bed. There was definitely a shell in the eggs. I ate them anyway. They were proud.",
  "Walked to work today instead of taking the bus. Saw the same dog walker I always see. He waved.",
  "Bought myself flowers. Yellow tulips. No occasion. They make the kitchen happier.",
  "Tried that little ramen place on 4th. The owner remembered my order from last time. I almost cried into the broth.",
  "Couldn't sleep so I baked banana bread at 2am. The neighbors will get the second loaf in the morning.",
  "My partner brought me tea without me asking. They knew. They always know.",
  "Watched my dad meet his grandson for the first time. Didn't know that kind of soft was in him.",
  "Twelve hours in the studio and I finally finished the track. Listening back, can't believe it came out of me.",
  "Old friend texted out of nowhere. We talked for two hours like no time had passed.",
  "First snow today. The dog had no idea what to do with it. Spent ten minutes spinning in circles.",
  "My boss apologized. Genuinely. I didn't know that was possible. Restored a little faith.",
  "Spent the afternoon at the bookstore with my daughter. She picked out a book about whales. We're gonna read it together tonight.",
  "Tried meditation again. Made it eight whole minutes before my brain wandered. Last week it was three. Counting it as a win.",
  "Moved into my own apartment for the first time at 34. No roommates. Just me and a hand-me-down couch. It's beautiful.",
  "Got the grant. I wasn't going to apply because I figured I'd lose. So glad I was wrong.",
  "Husband took the kids out so I could nap. Didn't sleep, but laid in silence for an hour. Same restoration.",
  "Saw my old physics teacher in the hardware store. He remembered me. Made my month.",
  "Wrote 1,200 words today. Some of them were even good. Almost done with chapter three.",
  "Took the long way home to listen to one more song. Worth it.",
  "Sister's been clean for six months. Watching her become herself again is the best thing I have ever seen.",
  "Made eye contact with a stranger on the train and we both smiled. Tiny moment. Carried me all day.",
  "Garden's first tomato of the season. Ate it standing up over the sink. Pure summer.",
  "Doctor said the new meds are working. I have my brain back, I think. Slowly.",
  "Watched a kid help an old man with his grocery bags. Restored a little hope today.",
  "Friend brought soup over when I had the flu. Didn't even come in. Just left it on the porch with a note. That's love.",
  "Finally said no to something I didn't want to do. Felt weird. Also amazing.",
  "Daughter asked if she could read to me tonight instead of the other way around. She's growing up.",
  "Sitting in the car after work just listening to rain on the windshield. Wasn't ready to go inside yet. Glad I gave myself the moment.",
  "Found a $20 in last winter's coat. Bought myself a really nice coffee. Felt rich.",
  "Walked away from a hard conversation feeling heard. Doesn't happen often. Holding onto it.",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWithoutReplacement(arr, count) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < count && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

async function clearSeed() {
  const result = await pool.query(
    `DELETE FROM users WHERE email LIKE $1 RETURNING id`,
    [`%@${SEED_DOMAIN}`]
  );
  console.log(`Cleared ${result.rowCount} previous seed users (cascade).`);
}

async function main() {
  console.log("Seeding demo data…");
  await clearSeed();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // 1) Users
  const users = [];
  const usedEmails = new Set();
  while (users.length < NUM_USERS) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const handle = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "");
    const email = `${handle}.${users.length + 1}@${SEED_DOMAIN}`;
    if (usedEmails.has(email)) continue;
    usedEmails.add(email);

    const name = `${first} ${last}`;
    const avatar =
      Math.random() < AVATAR_RATIO
        ? `https://i.pravatar.cc/300?u=${encodeURIComponent(email)}`
        : null;

    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, avatar_url, email_verified)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, name, email`,
      [email, passwordHash, name, avatar]
    );
    users.push(rows[0]);
  }
  console.log(`Created ${users.length} users (${Math.round(AVATAR_RATIO * 100)}% with avatars).`);

  // 2) Posts — distributed across users so the feed has variety
  // Pick distinct post bodies so we never duplicate content
  const postBodies = pickWithoutReplacement(POSTS, NUM_POSTS);

  let postsCreated = 0;
  for (const body of postBodies) {
    const author = pick(users);
    const mood = Math.random() < MOOD_RATIO ? pick(MOODS) : null;
    const isAnonymous = Math.random() < ANON_RATIO;
    const ageMinutes = Math.floor(Math.random() * MAX_AGE_DAYS * 24 * 60);

    await pool.query(
      `INSERT INTO gratitude_entries
        (user_id, content, mood, visibility, is_anonymous, created_at, updated_at)
       VALUES ($1, $2, $3, 'public', $4, NOW() - ($5::int * INTERVAL '1 minute'),
               NOW() - ($5::int * INTERVAL '1 minute'))`,
      [author.id, body, mood, isAnonymous, ageMinutes]
    );
    postsCreated++;
  }
  console.log(`Created ${postsCreated} public posts spread over the last ${MAX_AGE_DAYS} days.`);

  console.log("\nDone. Reload /feed to see them.");
  console.log(
    `(To remove later: DELETE FROM users WHERE email LIKE '%@${SEED_DOMAIN}';)`
  );
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
