// Shared photo projection contract. All charges are computed by the server.
export const PHOTO_MIN_SECONDS = 6;
export const PHOTO_MAX_SECONDS = 60;
export const PHOTO_MIN_COST = 10000;
export const DEMO_WALLET_CREDIT = 200000;
export const PHOTO_MAX_BYTES = 12 * 1024 * 1024;
export function photoCost(seconds) {
  if (!Number.isInteger(seconds) || seconds < PHOTO_MIN_SECONDS || seconds > PHOTO_MAX_SECONDS) return null;
  return seconds < 10 ? PHOTO_MIN_COST : 2000 * seconds;
}
