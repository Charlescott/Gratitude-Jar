import crypto from "crypto";
import { S3Client, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let cachedClient = null;

function getConfig() {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_PUBLIC_BASE_URL,
  } = process.env;

  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET ||
    !R2_PUBLIC_BASE_URL
  ) {
    const missing = [
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET",
      "R2_PUBLIC_BASE_URL",
    ].filter((k) => !process.env[k]);
    throw new Error(`R2 not configured — missing: ${missing.join(", ")}`);
  }

  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    publicBaseUrl: R2_PUBLIC_BASE_URL.replace(/\/$/, ""),
  };
}

export function isR2Configured() {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
}

function getClient() {
  if (cachedClient) return cachedClient;
  const { accountId, accessKeyId, secretAccessKey } = getConfig();
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function presignAvatarUpload({ userId, contentType, contentLength }) {
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error("Unsupported image type");
  }
  const MAX_BYTES = 2 * 1024 * 1024;
  if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_BYTES) {
    throw new Error("Image too large (max 2MB)");
  }

  const { bucket, publicBaseUrl } = getConfig();
  const client = getClient();
  const ext = EXT_BY_TYPE[contentType];
  const key = `avatars/${userId}/${Date.now()}-${crypto
    .randomBytes(6)
    .toString("hex")}.${ext}`;

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 300 });
  const publicUrl = `${publicBaseUrl}/${key}`;

  return { uploadUrl, publicUrl, key };
}

export async function deleteAvatar(objectUrl) {
  if (!objectUrl) return;
  const { bucket, publicBaseUrl } = getConfig();
  if (!objectUrl.startsWith(publicBaseUrl + "/")) return;
  const key = objectUrl.slice(publicBaseUrl.length + 1);
  if (!key) return;
  const client = getClient();
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err) {
    console.warn("R2 delete failed (non-fatal):", err?.message || err);
  }
}
