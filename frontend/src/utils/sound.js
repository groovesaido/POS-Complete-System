/**
 * Sound utility for playing audio files.
 *
 * In production Electron (file:// protocol), absolute paths like
 * `/cash-register-sound.mp3` resolve to the filesystem root instead of
 * the app directory. This utility uses Vite's BASE_URL (which is "./"
 * per the Vite config) to build correct relative paths that work in
 * both dev server (http://) and production Electron (file://).
 */

const BASE_URL = import.meta.env.BASE_URL || "./";

const SOUNDS = {
  checkout: "cash-register-sound.mp3",
  scanNotification: "scan-notification-sound.mp3",
};

/**
 * Build the correct URL for a public asset, compatible with both
 * Vite dev server and Electron file:// protocol.
 */
function assetUrl(filename) {
  // BASE_URL is "./" so this gives "./cash-register-sound.mp3"
  // Resolves correctly under both http:// and file:// protocols
  return `${BASE_URL}${filename}`;
}

/**
 * Play a sound by name. Silently fails if audio is unavailable.
 * @param {"checkout" | "scanNotification"} soundName
 * @param {number} [volume=0.5]
 */
export function playSound(soundName, volume = 0.5) {
  const filename = SOUNDS[soundName];
  if (!filename) {
    console.warn(`Unknown sound: "${soundName}"`);
    return;
  }

  try {
    const audio = new Audio(assetUrl(filename));
    audio.volume = volume;
    audio.play().catch(() => {
      // Silently fail — audio may be blocked by browser policy or unavailable
    });
  } catch {
    // Silently fail
  }
}

/**
 * Play the cash register checkout sound.
 * @param {number} [volume=0.5]
 */
export function playCheckoutSound(volume = 0.5) {
  playSound("checkout", volume);
}

/**
 * Play the scan notification sound.
 * @param {number} [volume=0.5]
 */
export function playScanSound(volume = 0.5) {
  playSound("scanNotification", volume);
}
