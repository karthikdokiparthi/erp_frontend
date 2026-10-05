import { useEffect } from 'react';

function playBeep(ok) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = ok ? 880 : 240;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (ok ? 0.18 : 0.28));
    osc.stop(ctx.currentTime + (ok ? 0.2 : 0.3));
    window.setTimeout(() => ctx.close().catch(() => {}), 400);
  } catch {
    // audio may be blocked
  }
}

export function ScanResultPopup({ alert, onClose }) {
  useEffect(() => {
    if (!alert) return undefined;
    playBeep(alert.kind === 'ok' || alert.kind === 'warn');
    const timer = window.setTimeout(() => onClose?.(), alert.kind === 'ok' ? 2200 : 2800);
    return () => window.clearTimeout(timer);
  }, [alert, onClose]);

  if (!alert) return null;

  const kind = alert.kind === 'fail' ? 'fail' : alert.kind === 'warn' ? 'warn' : 'ok';
  const mark = kind === 'fail' ? '!' : '✓';

  return (
    <div className="scan-popup-overlay" role="alertdialog" aria-live="assertive" onClick={onClose}>
      <div className={`scan-popup scan-popup-${kind}`} onClick={(event) => event.stopPropagation()}>
        <div className="scan-popup-mark">{mark}</div>
        <h2>{alert.title}</h2>
        {alert.code ? <p className="scan-popup-code">{alert.code}</p> : null}
        <p>{alert.message}</p>
        <button className="btn btn-primary" type="button" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}
