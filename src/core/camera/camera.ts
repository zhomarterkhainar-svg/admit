export type CameraErrorKind = 'denied' | 'notFound' | 'inUse' | 'insecure' | 'unknown';

export class CameraError extends Error {
  constructor(
    public readonly kind: CameraErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export interface CameraOptions {
  facingMode?: 'user' | 'environment';
  /** ideal capture height; width follows the camera's native aspect */
  height?: number;
}

/** Opens the webcam into the given <video>. Resolves once the first frame is decodable. */
export async function startCamera(
  video: HTMLVideoElement,
  { facingMode = 'user', height = 720 }: CameraOptions = {},
): Promise<MediaStream> {
  if (!window.isSecureContext) {
    throw new CameraError('insecure', 'Camera requires HTTPS or localhost');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('notFound', 'getUserMedia is not supported in this browser');
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode, height: { ideal: height }, frameRate: { ideal: 30 } },
    });
  } catch (err) {
    const name = (err as DOMException).name;
    if (name === 'NotAllowedError' || name === 'SecurityError')
      throw new CameraError('denied', 'Camera permission denied');
    if (name === 'NotFoundError' || name === 'OverconstrainedError')
      throw new CameraError('notFound', 'No camera found');
    if (name === 'NotReadableError')
      throw new CameraError('inUse', 'Camera is used by another app');
    throw new CameraError('unknown', String(err));
  }
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true; // iOS Safari
  await video.play();
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await new Promise((r) => video.addEventListener('loadeddata', r, { once: true }));
  }
  return stream;
}

export function stopCamera(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => t.stop());
}
