import crypto from "crypto";

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function generateFingerprint(title: string): string {
  const normalized = normalizeTitle(title);
  return crypto.createHash("md5").update(normalized).digest("hex");
}
