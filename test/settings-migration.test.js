const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { migrateLegacySettings } = require('../electron/main/ipc/settings');

const quiet = { log() {}, error() {} };

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tawlaty-settings-'));
  return {
    legacy: path.join(root, 'Baristaflow', 'settings.json'),
    next: path.join(root, 'Tawlaty', 'settings.json'),
  };
}

test('copies legacy settings when the new folder has none, keeping the original', () => {
  const { legacy, next } = setup();
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.writeFileSync(legacy, '{"printer":"A"}');
  assert.equal(migrateLegacySettings(next, legacy, quiet), true);
  assert.equal(fs.readFileSync(next, 'utf8'), '{"printer":"A"}');
  assert.ok(fs.existsSync(legacy));
});

test('is idempotent and never overwrites existing new settings', () => {
  const { legacy, next } = setup();
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.mkdirSync(path.dirname(next), { recursive: true });
  fs.writeFileSync(legacy, '{"printer":"old"}');
  fs.writeFileSync(next, '{"printer":"new"}');
  assert.equal(migrateLegacySettings(next, legacy, quiet), false);
  assert.equal(fs.readFileSync(next, 'utf8'), '{"printer":"new"}');
});

test('does nothing when there is no legacy file', () => {
  const { legacy, next } = setup();
  assert.equal(migrateLegacySettings(next, legacy, quiet), false);
  assert.ok(!fs.existsSync(next));
});
