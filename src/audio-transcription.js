const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

const AUDIO_FORMATS = {
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/mp3': 'mp3',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'audio/x-wav': 'wav',
};

function toAudioBuffer(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new Error('Audio data is missing or invalid. Record again and retry.');
}

function normalizeAudioUpload(data, mimeType = '') {
  const buffer = toAudioBuffer(data);
  if (!buffer.length) throw new Error('The audio recording is empty. Speak for a moment, then retry.');
  if (buffer.length > MAX_AUDIO_BYTES) {
    throw new Error('Audio recordings must be smaller than 20 MB. Record a shorter clip and retry.');
  }

  const normalizedMimeType = String(mimeType).split(';')[0].trim().toLowerCase();
  const extension = AUDIO_FORMATS[normalizedMimeType];
  if (!extension) {
    throw new Error('Unsupported audio format. Record again using a supported microphone format.');
  }

  return {
    buffer,
    fileName: `recording.${extension}`,
    mimeType: normalizedMimeType,
  };
}

function buildOpenAIMultipartBody(upload, boundary, model) {
  const fields = [
    `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\njson\r\n`,
  ].map((field) => Buffer.from(field));
  const fileHeader = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${upload.fileName}"\r\nContent-Type: ${upload.mimeType}\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);

  return {
    body: Buffer.concat([...fields, fileHeader, upload.buffer, footer]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function getTranscriptionProvider(activeProvider, configuredProviders = []) {
  const supportedProviders = ['openai', 'gemini'];
  if (supportedProviders.includes(activeProvider)) return activeProvider;
  return supportedProviders.find((provider) => configuredProviders.includes(provider)) || null;
}

module.exports = {
  MAX_AUDIO_BYTES,
  buildOpenAIMultipartBody,
  getTranscriptionProvider,
  normalizeAudioUpload,
};