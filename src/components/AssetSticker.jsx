import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { assetTypeLabel, formatInstalledOn } from '../utils/format';

function line(label, value) {
  if (value == null || value === '') {
    return null;
  }
  return `${label}: ${value}`;
}

export function assetDetailsText(asset) {
  if (!asset) return '';
  const type = String(asset.assetType || '').toUpperCase();
  const rows = [`ASSET CODE: ${asset.assetCode || '—'}`, `MAKE/BRAND: ${asset.brand || '—'}`];
  if (asset.assetType) {
    rows.splice(1, 0, `TYPE: ${assetTypeLabel(asset.assetType)}`);
  }
  if (type === 'DESKTOP') {
    rows.push(
      `MONITOR SL NO: ${asset.monitorSerial || '—'}`,
      `CPU SL NO: ${asset.cpuSerial || '—'}`,
      `LOCATION: ${asset.location || '—'}`,
      `SUPPLIER: ${asset.supplier || '—'}`,
      `INSTALLED: ${formatInstalledOn(asset.installedOn)}`,
      `USERNAME: ${asset.assignedUsername || '—'}`,
      `USER ID: ${asset.assignedUserId || '—'}`,
    );
  } else if (type === 'LAPTOP') {
    rows.push(
      `LAPTOP SL NO: ${asset.serialNumber || '—'}`,
      `SUPPLIER: ${asset.supplier || '—'}`,
      `MOUSE SL NO: ${asset.mouseSerial || '—'}`,
      `ETHERNET TO USB ADAPTER: ${asset.ethernetUsbAdapter || '—'}`,
      `USERNAME: ${asset.assignedUsername || '—'}`,
      `USER ID: ${asset.assignedUserId || '—'}`,
    );
  } else if (type === 'PRINTER') {
    rows.push(
      `SERIAL NO: ${asset.serialNumber || '—'}`,
      `MODEL NO: ${asset.modelNumber || '—'}`,
      `LOCATION: ${asset.location || '—'}`,
    );
  } else if (type === 'SWITCH') {
    rows.push(
      `SERIAL NO: ${asset.serialNumber || '—'}`,
      `MODEL NO: ${asset.modelNumber || '—'}`,
      `PORTS: ${asset.ports || '—'}`,
      `LOCATION: ${asset.location || '—'}`,
    );
  } else if (type === 'ROUTER') {
    rows.push(
      `SERIAL NO: ${asset.serialNumber || '—'}`,
      `MODEL NO: ${asset.modelNumber || '—'}`,
      `LOCATION: ${asset.location || '—'}`,
    );
  } else {
    rows.push(
      line('MONITOR SL NO', asset.monitorSerial),
      line('CPU SL NO', asset.cpuSerial),
      line('SERIAL NO', asset.serialNumber),
      line('MODEL NO', asset.modelNumber),
      line('LOCATION', asset.location),
      line('USERNAME', asset.assignedUsername),
      line('USER ID', asset.assignedUserId),
    );
  }
  return rows.filter(Boolean).join('\n');
}

export function AssetSticker({ asset, qrSrc }) {
  if (!asset) return null;
  return (
    <div className="asset-sticker">
      <div className="asset-qr">
        {qrSrc ? <img src={qrSrc} alt={`QR ${asset.assetCode}`} /> : <div className="asset-qr-placeholder">QR</div>}
        <div className="asset-qr-code">{asset.assetCode}</div>
      </div>
    </div>
  );
}

export function useAssetQr(asset) {
  const [src, setSrc] = useState('');
  const payload = assetDetailsText(asset);

  useEffect(() => {
    if (!payload) {
      setSrc('');
      return;
    }
    QRCode.toDataURL(payload, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#111111', light: '#ffffff' },
    })
      .then(setSrc)
      .catch(() => setSrc(''));
  }, [payload]);

  return src;
}
