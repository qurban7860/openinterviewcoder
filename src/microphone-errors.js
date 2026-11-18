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

module.exports = {
  getMicrophoneErrorMessage,
};