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
  'sunday'
]);

export function normalizeArtistName(name: string): string {
  return name
    .replace(/[•|·]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}.)]+$/u, '')
    .trim();
}

export function isLikelyArtistName(name: string): boolean {
  const normalized = normalizeArtistName(name);
  if (!normalized) return false;
  if (normalized.length < 2) return false;
  if (/^\d{1,2}:\d{2}/.test(normalized)) return false;
  if (/^\d{4}[.-]\d{1,2}[.-]\d{1,2}/.test(normalized)) return false;
  if (NON_ARTIST_WORDS.has(normalized.toLowerCase())) return false;
  return true;
}

export function dedupeArtistNames(names: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const rawName of names) {
    const name = normalizeArtistName(rawName);
    const key = name.toLowerCase();
    if (!isLikelyArtistName(name)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(name);
  }

  return output;
}

export function searchUrl(base: 'youtube' | 'soundcloud' | 'spotify', artistName: string): string {
  const encoded = encodeURIComponent(artistName);
  if (base === 'youtube') return `https://www.youtube.com/results?search_query=${encoded}%20DJ%20set`;
  if (base === 'soundcloud') return `https://soundcloud.com/search?q=${encoded}`;
  return `https://open.spotify.com/search/${encoded}`;
}
