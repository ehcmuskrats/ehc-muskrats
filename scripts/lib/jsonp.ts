/** Strip a JSONP wrapper `callback({...});` and parse the JSON inside. */
export function stripJsonp(text: string): any {
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) return JSON.parse(t);
  const start = t.indexOf('(');
  const end = t.lastIndexOf(')');
  if (start < 0 || end < start) throw new Error('response is neither JSON nor JSONP');
  return JSON.parse(t.slice(start + 1, end));
}

/** Endpoint name for logging, e.g. "Schedule". Never returns the query string (it holds WEHV's key). */
export function endpointName(url: string): string {
  try {
    const p = new URL(url).pathname;
    return p.split('/').filter(Boolean).pop() ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
