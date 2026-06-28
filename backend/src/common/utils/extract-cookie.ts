export function extractCookie(cookieHeader: string | undefined, name: string): string | null {
  const raw = cookieHeader ?? '';
  const match = raw
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}
