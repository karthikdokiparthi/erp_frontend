function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function hasGetUserMedia() {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

export async function openLiveCamera() {
  if (!hasGetUserMedia()) {
    throw Object.assign(new Error('This browser cannot open a live camera.'), { name: 'NotSupportedError' });
  }
  const trials = [
    { video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: { facingMode: { ideal: 'environment' } }, audio: false },
    { video: { facingMode: 'user' }, audio: false },
    { video: true, audio: false },
  ];
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const constraints of trials) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        lastError = err;
      }
    }
    const busy = lastError?.name === 'NotReadableError' || lastError?.name === 'AbortError';
    if (busy && attempt < 2) {
      await wait(250 * (attempt + 1));
      continue;
    }
    break;
  }
  throw lastError || new Error('Could not open the camera');
}

export function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function cameraMessage(err) {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Allow camera access to scan live. You can still use Take photo if needed.';
  }
  if (name === 'SecurityError' || name === 'NotSupportedError') {
    return 'This address blocks live camera. Open ERP with https:// and allow the camera, or use Take photo.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this device.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera is already in use. Close other camera apps, then scan again.';
  }
  return err?.message || 'Could not open the live camera';
}
