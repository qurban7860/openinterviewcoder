const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildOpenAIMultipartBody,
  getTranscriptionProvider,
  normalizeAudioUpload,
} = require('../src/audio-transcription');

test('normalizes browser-recorded WebM audio and chooses a safe file extension', () => {
  const upload = normalizeAudioUpload(new Uint8Array([1, 2, 3]), 'audio/webm;codecs=opus');

  assert.equal(upload.mimeType, 'audio/webm');
  assert.equal(upload.fileName, 'recording.webm');
  assert.deepEqual(upload.buffer, Buffer.from([1, 2, 3]));
});

test('rejects empty, unsupported, and oversized audio uploads', () => {
  assert.throws(() => normalizeAudioUpload(new Uint8Array(), 'audio/webm'), /empty/i);
  assert.throws(() => normalizeAudioUpload(new Uint8Array([1]), 'text/plain'), /unsupported audio format/i);
  assert.throws(() => normalizeAudioUpload(Buffer.alloc(20 * 1024 * 1024 + 1), 'audio/webm'), /20 MB/i);
});

test('builds a multipart transcription request with the audio bytes intact', () => {
  const upload = normalizeAudioUpload(Buffer.from([0, 1, 2]), 'audio/webm');
  const request = buildOpenAIMultipartBody(upload, 'test-boundary', 'whisper-1');

  assert.match(request.contentType, /multipart\/form-data; boundary=test-boundary/);
  assert.match(request.body.toString(), /name="model"\r\n\r\nwhisper-1/);
  assert.match(request.body.toString(), /filename="recording.webm"/);
  assert.ok(request.body.includes(Buffer.from([0, 1, 2])));
});

test('uses the active transcription provider or configured speech provider for Claude sessions', () => {
  assert.equal(getTranscriptionProvider('openai', ['openai']), 'openai');
  assert.equal(getTranscriptionProvider('anthropic', ['anthropic', 'gemini']), 'gemini');
  assert.equal(getTranscriptionProvider('anthropic', ['anthropic']), null);
});