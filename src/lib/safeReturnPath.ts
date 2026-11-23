export function safeReturnPath(value: unknown, origin: string) {
  if (typeof value !== "string" || !value.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(value)) return null;
  try {
    const target = new URL(value, origin);
    const path = decodeURIComponent(target.pathname);
    if (target.origin !== origin || path.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(path)) return null;
    return target.pathname + target.search + target.hash;
  } catch {
    return null;
  }
}
