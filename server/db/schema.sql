CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE gratitude_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    mood TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE prompt_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'monthly') ) DEFAULT 'daily',
    time_of_day TIME NOT NULL,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    category TEXT
);

CREATE TABLE user_reminders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL,         -- daily, weekly, monthly, custom
    time_of_day TIME NOT NULL,       -- when to send reminder
    last_sent TIMESTAMP,             -- track last sent reminder
    active BOOLEAN DEFAULT TRUE      -- in case user wants to pause reminders
);

ALTER TABLE user_reminders
ADD COLUMN timezone TEXT DEFAULT 'UTC';

