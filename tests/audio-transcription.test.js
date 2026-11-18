const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildOpenAIMultipartBody,
  buildGeminiAudioInput,
  buildGeminiTranscriptionRequest,
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

test('builds Gemini Interactions API audio input with matching MIME type and bytes', () => {
  const upload = normalizeAudioUpload(Buffer.from([4, 5, 6]), 'audio/webm');
  const input = buildGeminiAudioInput(upload);

  assert.equal(input[0].type, 'text');
  assert.match(input[0].text, /transcribe/i);
  assert.deepEqual(input[1], {
    type: 'audio',
    data: Buffer.from([4, 5, 6]).toString('base64'),
    mime_type: 'audio/webm',
  });
});

test('uses the supported Gemini Flash model without storing audio interactions', () => {
  const upload = normalizeAudioUpload(Buffer.from([7, 8]), 'audio/webm');
  const request = buildGeminiTranscriptionRequest(upload);

  assert.equal(request.model, 'gemini-3.8-flash');
  assert.equal(request.store, false);
  assert.equal(request.input[1].type, 'audio');
});

test('rejects Gemini inline audio that would exceed the total request limit', () => {
  const upload = normalizeAudioUpload(Buffer.alloc(14 * 1024 * 1024 + 1), 'audio/webm');

  assert.throws(() => buildGeminiTranscriptionRequest(upload), /shorter than 14 MB/i);
});