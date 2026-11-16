const test = require('node:test');
const assert = require('node:assert/strict');

const { buildScreenshotFileName } = require('../src/screenshot');

test('uploaded screenshot names are sanitized and preserve the extension', () => {
  const fileName = buildScreenshotFileName('My Screenshot (Final).png');
  assert.match(fileName, /^screenshot-/i);
  assert.match(fileName, /\.png$/i);
  assert.doesNotMatch(fileName, /\s|\(|\)/);
});

test('invalid screenshot names fall back to a safe filename', () => {
  const fileName = buildScreenshotFileName('');
  assert.match(fileName, /^screenshot-.*\.png$/i);
});
