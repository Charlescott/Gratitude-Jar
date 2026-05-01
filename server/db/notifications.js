const MAX_PER_USER = 100;

export async function createNotification(
  pool,
  { userId, type, title, body = null, link = null }
) {
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, link)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, title, body, link]
  );

  await pool.query(
    `DELETE FROM notifications
     WHERE id IN (
       SELECT id FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       OFFSET $2
     )`,
    [userId, MAX_PER_USER]
  );
}

export async function fanOutToCircleMembers(
  pool,
  { circleId, excludeUserId, type, title, body = null, link = null }
) {
  const { rowCount } = await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, link)
     SELECT cm.user_id, $3, $4, $5, $6
     FROM circle_memberships cm
     WHERE cm.circle_id = $1 AND cm.user_id <> $2`,
    [circleId, excludeUserId, type, title, body, link]
  );

  if (!rowCount) return;

  await pool.query(
    `DELETE FROM notifications
     WHERE id IN (
       SELECT id FROM (
         SELECT id,
                ROW_NUMBER() OVER (
                  PARTITION BY user_id
                  ORDER BY created_at DESC, id DESC
                ) AS rn
         FROM notifications
         WHERE user_id IN (
           SELECT cm.user_id FROM circle_memberships cm
           WHERE cm.circle_id = $1 AND cm.user_id <> $2
         )
       ) ranked
       WHERE rn > $3
     )`,
    [circleId, excludeUserId, MAX_PER_USER]
  );
}

export async function fanOutToFollowers(
  pool,
  { followeeId, type, title, body = null, link = null }
) {
  const { rowCount } = await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, link)
     SELECT f.follower_id, $2, $3, $4, $5
     FROM follows f
     WHERE f.followee_id = $1`,
    [followeeId, type, title, body, link]
  );

  if (!rowCount) return;

  await pool.query(
    `DELETE FROM notifications
     WHERE id IN (
       SELECT id FROM (
         SELECT id,
                ROW_NUMBER() OVER (
                  PARTITION BY user_id
                  ORDER BY created_at DESC, id DESC
                ) AS rn
         FROM notifications
         WHERE user_id IN (
           SELECT follower_id FROM follows WHERE followee_id = $1
         )
       ) ranked
       WHERE rn > $2
     )`,
    [followeeId, MAX_PER_USER]
  );
}
