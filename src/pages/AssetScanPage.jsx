import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { assetDetailsText } from '../components/AssetSticker';
import { BrandLockup } from '../components/BrandLockup';

export function AssetScanPage() {
  const [params] = useSearchParams();
  const code = params.get('code') || '';
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(code));

  useEffect(() => {
    if (!code) {
      setError('No asset code was provided.');
      setLoading(false);
      return;
    }
    setLoading(true);
    api(`/api/public/assets?code=${encodeURIComponent(code)}`)
      .then((data) => {
        setAsset(data);
        setError('');
      })
      .catch((err) => {
        setAsset(null);
        setError(extractError(err));
      })
      .finally(() => setLoading(false));
  }, [code]);

  return (
    <div className="asset-scan">
      <div className="asset-scan-head">
        <BrandLockup product="Assets" />
      </div>
      {code ? <p className="asset-scan-code">{code}</p> : null}
      {loading ? <p className="muted">Looking up asset…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {asset ? <pre className="asset-details-text">{assetDetailsText(asset)}</pre> : null}
    </div>
  );
}
