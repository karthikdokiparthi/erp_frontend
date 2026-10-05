import { sha256Digest } from './sha256.js';

function base64UrlEncode(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomBytes(size) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function createPkce() {
  const verifier = base64UrlEncode(randomBytes(32));
  const digest = await sha256Digest(new TextEncoder().encode(verifier));
  return {
    verifier,
    challenge: base64UrlEncode(digest),
    state: base64UrlEncode(randomBytes(16)),
  };
}

export function callbackRedirectUri() {
  return `${window.location.origin}/callback`;
}

export function authorizeUrl({ issuer, clientId, redirectUri, scopes, state, challenge, theme }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    theme: theme === 'dark' ? 'dark' : 'light',
  });
  return `${issuer.replace(/\/$/, '')}/oauth2/authorize?${params.toString()}`;
}
