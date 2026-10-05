import jsQR from 'jsqr';
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library';

const MAX_SIDE = 1400;

function tick() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

export function shouldUsePhotoCapture() {
  if (typeof navigator === 'undefined') return false;
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
  return Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);
}

function canvasFrom(source, sx, sy, sw, sh, dw, dh, rotate = 0) {
  const width = Math.max(1, Math.round(dw));
  const height = Math.max(1, Math.round(dh));
  const canvas = document.createElement('canvas');
  const swapped = rotate === 90 || rotate === 270;
  canvas.width = swapped ? height : width;
  canvas.height = swapped ? width : height;
  const context = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
  if (!context) return canvas;
  context.imageSmoothingEnabled = false;
  if (rotate) {
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((rotate * Math.PI) / 180);
    context.drawImage(source, sx, sy, sw, sh, -width / 2, -height / 2, width, height);
  } else {
    context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
  }
  return canvas;
}

function readPixels(canvas) {
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context || !canvas.width || !canvas.height) return null;
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }
}

function contrastPixels(pixels) {
  const copy = new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
  const data = copy.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    data[i] = gray;
    if (gray < min) min = gray;
    if (gray > max) max = gray;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < data.length; i += 4) {
    let value = ((data[i] - min) / range) * 255;
    value = Math.max(0, Math.min(255, (value - 128) * 1.5 + 128));
    data[i] = data[i + 1] = data[i + 2] = value;
  }
  return copy;
}

function zxingFromPixels(pixels) {
  const { data, width, height } = pixels;
  const luminances = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    luminances[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }
  const source = new RGBLuminanceSource(luminances, width, height);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new MultiFormatReader();
  reader.setHints(hints);
  try {
    const text = reader.decode(new BinaryBitmap(new HybridBinarizer(source)))?.getText?.() || '';
    if (text) return text;
  } catch {
    reader.reset();
  }
  try {
    const text = reader.decode(new BinaryBitmap(new GlobalHistogramBinarizer(source)))?.getText?.() || '';
    if (text) return text;
  } catch {
    reader.reset();
  }
  try {
    return reader.decode(new BinaryBitmap(new HybridBinarizer(source.invert())))?.getText?.() || '';
  } catch {
    reader.reset();
    return '';
  }
}

function jsqrFromPixels(pixels) {
  try {
    return jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' })?.data || '';
  } catch {
    return '';
  }
}

async function detectBarcode(source) {
  if (!('BarcodeDetector' in window)) return '';
  try {
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const codes = await detector.detect(source);
    return codes[0]?.rawValue || '';
  } catch {
    return '';
  }
}

function decodeCanvas(canvas) {
  const pixels = readPixels(canvas);
  if (!pixels) return '';
  return zxingFromPixels(pixels) || jsqrFromPixels(pixels) || zxingFromPixels(contrastPixels(pixels));
}

function tryRegion(base, sx, sy, sw, sh, rotate = 0, size = 900) {
  const fit = Math.min(1, size / Math.max(sw, sh, 1));
  return decodeCanvas(canvasFrom(base, sx, sy, sw, sh, sw * fit, sh * fit, rotate));
}

async function decodeFromSource(source, sourceWidth, sourceHeight) {
  if (!sourceWidth || !sourceHeight) return '';
  const fromDetector = await detectBarcode(source);
  if (fromDetector) return fromDetector;

  const scale = Math.min(1, MAX_SIDE / Math.max(sourceWidth, sourceHeight));
  const base = canvasFrom(
    source,
    0,
    0,
    sourceWidth,
    sourceHeight,
    Math.round(sourceWidth * scale),
    Math.round(sourceHeight * scale)
  );
  const fromBaseDetector = await detectBarcode(base);
  if (fromBaseDetector) return fromBaseDetector;

  const { width, height } = base;
  const full = tryRegion(base, 0, 0, width, height, 0, 1000) || tryRegion(base, 0, 0, width, height, 0, 720);
  if (full) return full;

  const cw = Math.round(width * 0.55);
  const ch = Math.round(height * 0.55);
  const center = tryRegion(base, Math.round((width - cw) / 2), Math.round((height - ch) / 2), cw, ch, 0, 800);
  if (center) return center;

  await tick();
  const tw = Math.round(width * 0.48);
  const th = Math.round(height * 0.48);
  const xs = [0, Math.round((width - tw) / 2), width - tw];
  const ys = [0, Math.round((height - th) / 2), height - th];
  for (const x of xs) {
    for (const y of ys) {
      const raw = tryRegion(base, x, y, tw, th, 0, 700);
      if (raw) return raw;
    }
  }

  await tick();
  for (const rotate of [90, 180, 270]) {
    const raw = tryRegion(base, 0, 0, width, height, rotate, 800);
    if (raw) return raw;
  }
  return '';
}

async function loadSource(file) {
  const url = URL.createObjectURL(file);
  const cleanup = () => URL.revokeObjectURL(url);

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
    if (!bitmap.width || !bitmap.height) {
      bitmap.close?.();
      throw new Error('empty image');
    }
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => {
        bitmap.close?.();
        cleanup();
      },
    };
  } catch {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        try {
          await img.decode();
        } catch {
          // Safari may not implement decode()
        }
        resolve(img);
      };
      img.onerror = () => reject(new Error('Could not open that photo'));
      img.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      cleanup,
    };
  }
}

export async function decodeQrFromFile(file) {
  if (!file) return '';
  const loaded = await loadSource(file);
  try {
    return await decodeFromSource(loaded.source, loaded.width, loaded.height);
  } finally {
    loaded.cleanup();
  }
}
