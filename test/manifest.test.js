const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));

test('manifest uses MV3 and only the required API host permission', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.host_permissions, ['https://adachidb.net/*']);
});

test('URL helpers load before the content script', () => {
  assert.deepEqual(
    manifest.content_scripts[0].js,
    ['js/url.js', 'js/content.js']
  );
});

test('every manifest file exists', () => {
  const files = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    ...manifest.content_scripts.flatMap((entry) => entry.js),
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon)
  ];

  for (const file of new Set(files)) {
    assert.equal(fs.existsSync(path.join(rootDir, file)), true, `${file} is missing`);
  }
});
