import { comparableName, roughNameMatchScore } from './artistUtils';

export type MusicBrainzArtistMatch = {
  id: string;
  name: string;
  score: number;
  type: string | null;
  disambiguation: string | null;
  tags: string[];
  matchScore: number;
};

type MusicBrainzArtist = {
  id?: string;
  name?: string;
  'sort-name'?: string;
  score?: number | string;
  type?: string;
  disambiguation?: string;
  tags?: Array<{ name?: string }>;
  aliases?: Array<{ name?: string }>;
};

type MusicBrainzSearchResponse = {
  artists?: MusicBrainzArtist[];
  error?: string;
};

function parseMbScore(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function bestCandidateScore(inputName: string, artist: MusicBrainzArtist): number {
  const names = [artist.name, artist['sort-name'], ...(artist.aliases ?? []).map((alias) => alias.name)]
    .filter((name): name is string => Boolean(name));

  return names.reduce((best, name) => Math.max(best, roughNameMatchScore(inputName, name)), 0);
}

export async function searchMusicBrainzArtist(
  artistName: string,
  warnings: string[]
): Promise<MusicBrainzArtistMatch | null> {
  const comparable = comparableName(artistName);
  if (!comparable || comparable.length < 2) return null;

  const url = new URL('https://musicbrainz.org/ws/2/artist/');
  url.searchParams.set('query', `artist:"${artistName}" OR alias:"${artistName}"`);
  url.searchParams.set('fmt', 'json');
  url.searchParams.set('limit', '5');

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LineupLens/0.3 (lineup-lens-vercel-app)'
      }
    });

    const data = (await response.json()) as MusicBrainzSearchResponse;

    if (!response.ok || data.error) {
      warnings.push(data.error ?? `MusicBrainz search failed for ${artistName}.`);
      return null;
    }

    const ranked = (data.artists ?? [])
      .map((artist) => {
        const matchScore = bestCandidateScore(artistName, artist);
        return {
          artist,
          matchScore,
          mbScore: parseMbScore(artist.score)
        };
      })
      .filter((item) => item.artist.id && item.artist.name)
      .sort((a, b) => b.matchScore + b.mbScore / 100 - (a.matchScore + a.mbScore / 100));

    const best = ranked[0];
    if (!best || best.matchScore < 0.55 || best.mbScore < 45) return null;

    return {
      id: best.artist.id!,
      name: best.artist.name!,
      score: best.mbScore,
      type: best.artist.type ?? null,
      disambiguation: best.artist.disambiguation ?? null,
      tags: (best.artist.tags ?? [])
        .map((tag) => tag.name)
        .filter((tag): tag is string => Boolean(tag))
        .slice(0, 8),
      matchScore: best.matchScore
    };
  } catch (error) {
    warnings.push(`MusicBrainz error for ${artistName}: ${error instanceof Error ? error.message : 'Unknown error'}.`);
    return null;
  }
}
