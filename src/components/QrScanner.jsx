import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { cameraMessage, openLiveCamera, stopStream } from '../utils/camera';
import { decodeQrFromFile } from '../utils/decodeQr';
import { parseAssetCodeFromScan } from '../utils/format';

function emitCode(raw, lastCode, onCode) {
  const parsed = parseAssetCodeFromScan(raw);
  if (!parsed || parsed === lastCode.current) {
    return false;
  }
  lastCode.current = parsed;
  onCode(parsed);
  window.setTimeout(() => {
    if (lastCode.current === parsed) {
      lastCode.current = '';
    }
  }, 1800);
  return true;
}

export function QrScanner({ onCode, stream, onAlert }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const onCodeRef = useRef(onCode);
  const onAlertRef = useRef(onAlert);
  const lastCode = useRef('');
  const localStreamRef = useRef(null);
  const [live, setLive] = useState(Boolean(stream));
  const [status, setStatus] = useState(stream ? 'Point the camera at the asset QR.' : 'Opening camera…');
  const [error, setError] = useState('');
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [retry, setRetry] = useState(0);

  onCodeRef.current = onCode;
  onAlertRef.current = onAlert;

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let detector;
    let scanning = false;

    function releaseLocal() {
      stopStream(localStreamRef.current);
      localStreamRef.current = null;
    }

    function readFrame() {
      if (cancelled || scanning) {
        if (!cancelled) {
          raf = window.requestAnimationFrame(readFrame);
        }
        return;
      }
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) {
        raf = window.requestAnimationFrame(readFrame);
        return;
      }
      scanning = true;
      const width = video.videoWidth;
      const height = video.videoHeight;
      const insetX = Math.round(width * 0.16);
      const insetY = Math.round(height * 0.16);
      const cropW = Math.max(32, width - insetX * 2);
      const cropH = Math.max(32, height - insetY * 2);

      Promise.resolve()
        .then(async () => {
          let raw = '';
          if (detector) {
            const codes = await detector.detect(video);
            raw = codes[0]?.rawValue || '';
          }
          if (!raw && canvas) {
            const maxSide = 480;
            const scale = Math.min(1, maxSide / Math.max(cropW, cropH));
            canvas.width = Math.max(1, Math.round(cropW * scale));
            canvas.height = Math.max(1, Math.round(cropH * scale));
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.imageSmoothingEnabled = false;
            context.drawImage(video, insetX, insetY, cropW, cropH, 0, 0, canvas.width, canvas.height);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
            raw = jsQR(pixels.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' })?.data || '';
          }
          if (raw) {
            emitCode(raw, lastCode, onCodeRef.current);
          }
        })
        .catch(() => {})
        .finally(() => {
          scanning = false;
          if (!cancelled) {
            raf = window.requestAnimationFrame(readFrame);
          }
        });
    }

    async function attach(active) {
      const video = videoRef.current;
      if (!video || !active) {
        return;
      }
      video.srcObject = active;
      video.muted = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      await video.play();
      if (cancelled) {
        return;
      }
      setLive(true);
      setError('');
      setStatus('Point the camera at the asset QR.');
      raf = window.requestAnimationFrame(readFrame);
    }

    async function start() {
      setError('');
      if ('BarcodeDetector' in window) {
        try {
          detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch {
          detector = null;
        }
      }
      if (stream) {
        try {
          await attach(stream);
        } catch (err) {
          if (!cancelled) {
            setLive(false);
            setError(cameraMessage(err));
            setStatus('Live camera could not start. Use Take photo.');
            onAlertRef.current?.({
              kind: 'fail',
              title: 'Camera failed',
              message: cameraMessage(err),
            });
          }
        }
        return;
      }
      setStatus('Opening camera…');
      try {
        const next = await openLiveCamera();
        if (cancelled) {
          stopStream(next);
          return;
        }
        localStreamRef.current = next;
        await attach(next);
      } catch (err) {
        releaseLocal();
        if (!cancelled) {
          setLive(false);
          setError(cameraMessage(err));
          setStatus('Live camera could not start. Use Take photo.');
          onAlertRef.current?.({
            kind: 'fail',
            title: 'Camera failed',
            message: cameraMessage(err),
          });
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      const video = videoRef.current;
      if (video) {
        video.srcObject = null;
      }
      releaseLocal();
    };
  }, [stream, retry]);

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusyPhoto(true);
    setError('');
    setStatus('Reading QR from photo…');
    try {
      const raw = await decodeQrFromFile(file);
      if (!emitCode(raw, lastCode, onCodeRef.current)) {
        setStatus(live ? 'Point the camera at the asset QR.' : '');
        setError('Could not read a QR in that photo. Hold the sticker inside the square and try again.');
        onAlertRef.current?.({
          kind: 'fail',
          title: 'Scan failed',
          message: 'Could not read a QR in that photo. Hold the sticker inside the square and try again.',
        });
        return;
      }
      setStatus('QR read. Saving…');
    } catch (err) {
      setStatus('');
      setError(err?.message || 'Could not read that photo');
    } finally {
      setBusyPhoto(false);
    }
  }

  return (
    <div className="audit-scanner">
      <div className={`audit-scanner-frame${live ? ' is-live' : ' is-fallback'}`}>
        <video ref={videoRef} className="audit-scanner-video" autoPlay muted playsInline hidden={!live} />
        <canvas ref={canvasRef} className="audit-scanner-canvas" />
        {live ? <div className="audit-scanner-reticle" aria-hidden="true" /> : null}
        {!live ? (
          <div className="audit-scanner-fallback">
            <p>Live QR scanner</p>
            <p className="muted">Allow the camera to scan in this screen. Point at the sticker — no need to take a photo.</p>
          </div>
        ) : null}
      </div>
      {error ? <p className="form-error">{error}</p> : status ? <p className="muted">{status}</p> : null}
      <div className="audit-scanner-actions">
        {!live ? (
          <button className="btn btn-primary" type="button" onClick={() => setRetry((n) => n + 1)}>
            Start live scan
          </button>
        ) : null}
        <label className="btn btn-ghost">
          {busyPhoto ? 'Reading…' : 'Take photo'}
          <input className="sr-only" type="file" accept="image/*" capture="environment" disabled={busyPhoto} onChange={handlePhoto} />
        </label>
        <label className="btn btn-ghost">
          Choose photo
          <input className="sr-only" type="file" accept="image/*" disabled={busyPhoto} onChange={handlePhoto} />
        </label>
      </div>
    </div>
  );
}
