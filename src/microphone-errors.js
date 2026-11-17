function getMicrophoneErrorMessage(errorName = '') {
  const messages = {
    NotAllowedError: 'Microphone permission was denied. Allow microphone access in your operating system settings and retry.',
    PermissionDeniedError: 'Microphone permission was denied. Allow microphone access in your operating system settings and retry.',
    NotFoundError: 'No microphone device was found. Connect a microphone, select it, and retry.',
    DevicesNotFoundError: 'No microphone device was found. Connect a microphone, select it, and retry.',
    NotReadableError: 'The microphone is busy or unavailable. Close other apps using it and retry.',
    TrackStartError: 'The microphone is busy or unavailable. Close other apps using it and retry.',
    OverconstrainedError: 'The selected microphone is unavailable. Choose another device and retry.',
    ConstraintNotSatisfiedError: 'The selected microphone is unavailable. Choose another device and retry.',
    SecurityError: 'Microphone access is blocked by the application security settings.',
  };

  return messages[errorName] || 'Microphone access failed. Check that a device is connected and that operating system permissions allow access.';
}

function getSpeechRecognitionErrorMessage(errorName = '') {
  const errors = {
    network: {
      message: 'Speech recognition service is unavailable. Check your internet connection and retry. Your microphone is not necessarily disconnected; you can type your question in chat meanwhile.',
      status: 'Speech service unavailable (network)',
      terminal: true,
    },
    'not-allowed': {
      message: 'Speech recognition permission was denied. Allow microphone access in operating system settings and retry.',
      status: 'Microphone permission denied',
      terminal: true,
    },
    'service-not-allowed': {
      message: 'The browser speech-recognition service is blocked or unavailable. You can type your question in chat instead.',
      status: 'Speech service unavailable',
      terminal: true,
    },
    'audio-capture': {
      message: 'Speech recognition could not access the microphone. Check its connection and close other apps using it.',
      status: 'Microphone unavailable',
      terminal: true,
    },
    'no-speech': {
      message: 'No speech was detected. Check the selected microphone and input level, then try again.',
      status: 'No speech detected',
      terminal: true,
    },
    aborted: {
      message: '',
      status: 'Listening stopped',
      terminal: true,
    },
  };

  return errors[errorName] || {
    message: 'Speech recognition stopped unexpectedly. You can retry or type your question in chat.',
    status: 'Speech recognition stopped',
    terminal: true,
  };
}

module.exports = {
  getMicrophoneErrorMessage,
  getSpeechRecognitionErrorMessage,
};