export type ApiError = { error: string; issues?: unknown };

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = (body ?? { error: res.statusText }) as ApiError;
    throw new Error(err.error || `Errore ${res.status}`);
  }
  return body as T;
}
