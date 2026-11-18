const test = require('node:test');
const assert = require('node:assert/strict');

const { getMicrophoneErrorMessage } = require('../src/microphone-errors');

test('busy microphone errors explain how to recover', () => {
  const error = getMicrophoneErrorMessage('NotReadableError');

  assert.match(error, /microphone is busy or unavailable/i);
  assert.match(error, /other apps/i);
});

test('microphone device errors provide a device-specific recovery message', () => {
  const error = getMicrophoneErrorMessage('NotFoundError');

  assert.match(error, /no microphone device/i);
  assert.match(error, /connect a microphone/i);
});

test('microphone permission errors are distinguished from missing devices', () => {
  const error = getMicrophoneErrorMessage('NotAllowedError');

  assert.match(error, /permission/i);
  assert.match(error, /settings/i);
});