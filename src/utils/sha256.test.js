import assert from 'node:assert/strict';
import test from 'node:test';
import { sha256, sha256Digest } from './sha256.js';

function hex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

test('sha256 matches the FIPS vector for abc', () => {
  const digest = sha256(new TextEncoder().encode('abc'));
  assert.equal(hex(digest), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('sha256 matches crypto.subtle for a PKCE-sized verifier and a multi-block message', async () => {
  const samples = [
    '',
    'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    'x'.repeat(80),
  ];
  for (const sample of samples) {
    const bytes = new TextEncoder().encode(sample);
    const expected = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    assert.deepEqual(sha256(bytes), expected);
  }
});

test('sha256Digest uses the JavaScript hash when subtle is missing', async () => {
  const bytes = new TextEncoder().encode('http://192.168.1.14 pkce');
  const viaSubtle = await sha256Digest(bytes, crypto.subtle);
  const viaJs = await sha256Digest(bytes, null);
  assert.deepEqual(viaJs, sha256(bytes));
  assert.deepEqual(viaJs, viaSubtle);
});
