/** Empty in local dev so the Vite proxy still serves /api. Production sets the Render origin. */
export function apiUrl(path) {
  if (typeof path !== 'string' || path.length === 0) {
    return path;
  }
  if (/^(https?:|blob:|data:)/i.test(path)) {
    return path;
  }
  const base = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  if (!base || !path.startsWith('/api')) {
    return path;
  }
  return `${base}${path}`;
}

export async function api(path, options = {}) {
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...options,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      (typeof data === 'string' ? data : null) ||
      `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function extractError(error) {
  return error?.data?.message || error?.data?.error || error?.message || 'Something went wrong';
}
