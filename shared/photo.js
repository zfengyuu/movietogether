// Shared projection pricing and playback-suspension contract.
// Cost is denominated in demo credits pegged for display to VND, not real funds.
export const PHOTO_MIN_SECONDS = 1;
export const PHOTO_MAX_SECONDS = 60;
export const PHOTO_VND_PER_SECOND = 1000;
export const DEMO_WALLET_CREDIT = 200000;
export const PHOTO_MAX_BYTES = 12 * 1024 * 1024;
export function photoCost(seconds) {
  if (!Number.isInteger(seconds) || seconds < PHOTO_MIN_SECONDS || seconds > PHOTO_MAX_SECONDS) return null;
  return seconds * PHOTO_VND_PER_SECOND;
}
// Freeze the *server's* authoritative playback clock at the first paid image.
// Calling again for queued photos must not overwrite the original playing state.
export function freezePlaybackForPhoto(room, now=Date.now()) {
  if (room.photoPlayback) return;
  room.photoPlayback = {resumePlaying: !!room.media.playing};
  room.media.position = Math.max(0,room.media.position + (room.media.playing ? (now-room.media.updatedAt)/1000 : 0));
  room.media.playing = false;
  room.media.updatedAt = now;
}
// Restore exactly the previous paused/playing state at the preserved position.
export function restorePlaybackAfterPhotos(room, now=Date.now()) {
  if (!room.photoPlayback) return;
  room.media.playing = room.photoPlayback.resumePlaying;
  room.media.updatedAt = now;
  room.photoPlayback = null;
}
