/**
 * Security helpers for the main process.
 *
 * The main window loads a REMOTE web app (APP_URL) and exposes privileged IPC
 * (silent printing, cash drawer, settings writes). These helpers make sure only
 * that exact origin can navigate the window or call IPC handlers.
 */

/**
 * Returns the origin of a URL, or null if it cannot be parsed.
 * @param {string} url
 * @returns {string | null}
 */
function originOf(url) {
  try {
    const { origin } = new URL(url);
    // Opaque origins (data:, about:blank, file:) serialize as the string "null".
    return origin && origin !== 'null' ? origin : null;
  } catch {
    return null;
  }
}

/**
 * Exact-origin comparison (scheme + host + port). A prefix check would let
 * `https://app.example.com.evil.tld` through.
 * @param {string} url
 * @param {string} appUrl
 */
function isSameOrigin(url, appUrl) {
  const appOrigin = originOf(appUrl);
  return appOrigin !== null && originOf(url) === appOrigin;
}

/**
 * True when an IPC event was sent by a frame whose URL is on the app origin.
 * Frames from other origins (third-party iframes, a navigated-away window)
 * are rejected.
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {string} appUrl
 */
function isTrustedSender(event, appUrl) {
  const frameUrl = event && event.senderFrame && event.senderFrame.url;
  return typeof frameUrl === 'string' && isSameOrigin(frameUrl, appUrl);
}

/**
 * Wraps ipcMain so every `handle()` registration rejects untrusted senders.
 * Pass the returned object to the IPC modules instead of the raw ipcMain.
 * @param {Electron.IpcMain} ipcMain
 * @param {string} appUrl
 */
function guardIpcMain(ipcMain, appUrl) {
  return {
    handle(channel, listener) {
      ipcMain.handle(channel, (event, ...args) => {
        if (!isTrustedSender(event, appUrl)) {
          const from = (event && event.senderFrame && event.senderFrame.url) || 'unknown';
          console.warn(`[security] Blocked IPC "${channel}" from untrusted sender: ${from}`);
          throw new Error('Untrusted IPC sender');
        }
        return listener(event, ...args);
      });
    },
  };
}

module.exports = { originOf, isSameOrigin, isTrustedSender, guardIpcMain };
