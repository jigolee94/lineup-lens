const NON_ARTIST_WORDS = new Set([
  'festival',
  'lineup',
  'stage',
  'main stage',
  'doors open',
  'ticket',
  'tickets',
  'after party',
  'official',
  'presented by',
  'sponsored by',
  'friday',
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'free entry',
  'open air',
  'location',
  'venue',
  'instagram',
  'sound system',
  'timetable',
  'schedule'
]);

export function normalizeArtistName(name: string): string {
  return name
    .replace(/[•|·]/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}.)]+$/u, '')
    .trim();
}

export function comparableName(name: string): string {
  return normalizeArtistName(name)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isLikelyArtistName(name: string): boolean {
  const normalized = normalizeArtistName(name);
  const lower = normalized.toLowerCase();
  if (!normalized) return false;
  if (normalized.length < 2) return false;
  if (normalized.length > 48) return false;
  if (/^\d{1,2}:\d{2}/.test(normalized)) return false;
  if (/^\d{4}[.-]\d{1,2}[.-]\d{1,2}/.test(normalized)) return false;
  if (/^[+\-_=~*#\d\s]+$/.test(normalized)) return false;
  if (NON_ARTIST_WORDS.has(lower)) return false;
  if (lower.includes('@') || lower.includes('www.')) return false;
  return true;
}

export function dedupeArtistNames(names: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const rawName of names) {
    const name = normalizeArtistName(rawName);
    const key = comparableName(name);
    if (!isLikelyArtistName(name)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(name);
  }

  return output;
}

export function roughNameMatchScore(a: string, b: string): number {
  const left = comparableName(a);
  const right = comparableName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.78;

  const leftTokens = new Set(left.split(' ').filter(Boolean));
  const rightTokens = new Set(right.split(' ').filter(Boolean));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

export function searchUrl(base: 'youtube' | 'soundcloud' | 'spotify', artistName: string): string {
  const encoded = encodeURIComponent(artistName);
  if (base === 'youtube') return `https://www.youtube.com/results?search_query=${encoded}%20DJ%20set`;
  if (base === 'soundcloud') return `https://soundcloud.com/search?q=${encoded}`;
  return `https://open.spotify.com/search/${encoded}`;
}
