import { createHash } from "node:crypto";

export const DELETION_ENDPOINT = "https://charsi-app.vercel.app/api/ebay/account-deletion";

const TOKEN = /^[A-Za-z0-9_-]{32,80}$/;

export function deletionToken(): string | null {
  const token = process.env.EBAY_DELETION_TOKEN?.trim() ?? "";
  return TOKEN.test(token) ? token : null;
}

export function deletionEndpoint(): string {
  const configured = process.env.EBAY_DELETION_ENDPOINT?.trim();
  return configured && configured.startsWith("https://") ? configured : DELETION_ENDPOINT;
}

export function challengeResponse(challengeCode: string, verificationToken: string, endpoint: string): string {
  return createHash("sha256").update(challengeCode).update(verificationToken).update(endpoint).digest("hex");
}
