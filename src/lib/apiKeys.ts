import "server-only";
import crypto from "crypto";

const KEY_PREFIX = "pk_live_";
const PREFIX_DISPLAY_LENGTH = 12;

// Generates a new API key. The full key is returned once and never stored -
// only its SHA-256 hash is persisted, so it can be verified later but never
// recovered or displayed again.
export function generateApiKey() {
  const secret = crypto.randomBytes(24).toString("hex");
  const fullKey = `${KEY_PREFIX}${secret}`;
  return {
    fullKey,
    keyPrefix: fullKey.slice(0, PREFIX_DISPLAY_LENGTH),
    keyHash: hashApiKey(fullKey),
  };
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}
