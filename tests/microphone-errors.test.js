const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getMicrophoneErrorMessage,
  getSpeechRecognitionErrorMessage,
} = require('../src/microphone-errors');

test('speech network errors explain that recognition service is unavailable, not the microphone', () => {
  const error = getSpeechRecognitionErrorMessage('network');

  assert.match(error.message, /speech recognition service/i);
  assert.match(error.message, /internet connection/i);
  assert.equal(error.terminal, true);
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