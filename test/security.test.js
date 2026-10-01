const test = require('node:test');
const assert = require('node:assert/strict');
const { isSameOrigin, isTrustedSender, guardIpcMain } = require('../electron/main/security');

const APP = 'https://app.tawlaty.com';

test('isSameOrigin accepts the exact app origin only', () => {
  assert.equal(isSameOrigin('https://app.tawlaty.com/#/pos', APP), true);
  assert.equal(isSameOrigin('https://app.tawlaty.com.evil.tld/', APP), false);
  assert.equal(isSameOrigin('http://app.tawlaty.com/', APP), false);
  assert.equal(isSameOrigin('https://app.tawlaty.com:8443/', APP), false);
  assert.equal(isSameOrigin('data:text/html,hi', APP), false);
  assert.equal(isSameOrigin('not a url', APP), false);
});

test('isTrustedSender requires a sender frame on the app origin', () => {
  assert.equal(isTrustedSender({ senderFrame: { url: `${APP}/#/admin` } }, APP), true);
  assert.equal(isTrustedSender({ senderFrame: { url: 'https://evil.example/' } }, APP), false);
  assert.equal(isTrustedSender({ senderFrame: null }, APP), false);
  assert.equal(isTrustedSender(undefined, APP), false);
});

test('guardIpcMain rejects untrusted senders and passes trusted calls through', async () => {
  const registered = {};
  const fakeIpcMain = { handle: (channel, listener) => { registered[channel] = listener; } };
  const guarded = guardIpcMain(fakeIpcMain, APP);
  guarded.handle('printers:openDrawer', (_event, arg) => `ok:${arg}`);

  assert.equal(await registered['printers:openDrawer']({ senderFrame: { url: `${APP}/` } }, 'x'), 'ok:x');
  assert.throws(
    () => registered['printers:openDrawer']({ senderFrame: { url: 'https://app.tawlaty.com.evil.tld/' } }, 'x'),
    /Untrusted IPC sender/
  );
});
