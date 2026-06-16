import { roughNameMatchScore } from './artistUtils';

export type LastFmProfile = {
  genres: string[];
  description: string | null;
};

export type LastFmArtistSearchMatch = {
  name: string;
  url: string | null;
  listeners: number | null;
  matchScore: number;
};

type LastFmTopTagsResponse = {
  toptags?: {
    tag?: Array<{ name?: string }>;
  };
  error?: number;
  message?: string;
};

type LastFmArtistInfoResponse = {
  artist?: {
    bio?: {
      summary?: string;
    };
  };
  error?: number;
  message?: string;
};

type LastFmArtistSearchResponse = {
  results?: {
    artistmatches?: {
      artist?: Array<{
        name?: string;
        url?: string;
        listeners?: string;
      }>;
    };
  };
  error?: number;
  message?: string;
};

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function parseListeners(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function isLastFmArtistNotFound(error?: number, message?: string): boolean {
  return error === 6 || /artist.*could not be found/i.test(message ?? '');
}

export async function searchLastFmArtist(
  artistName: string,
  warnings: string[]
): Promise<LastFmArtistSearchMatch | null> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL('https://ws.audioscrobbler.com/2.0/');
    url.searchParams.set('method', 'artist.search');
    url.searchParams.set('artist', artistName);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '5');

    const response = await fetch(url);
    const data = (await response.json()) as LastFmArtistSearchResponse;

    if (!response.ok || data.error) {
      if (!isLastFmArtistNotFound(data.error, data.message)) {
        warnings.push(data.message ?? `Last.fm artist search failed for ${artistName}.`);
      }
      return null;
    }

    const ranked = (data.results?.artistmatches?.artist ?? [])
      .map((artist) => ({
        name: artist.name ?? '',
        url: artist.url ?? null,
        listeners: parseListeners(artist.listeners),
        matchScore: roughNameMatchScore(artistName, artist.name ?? '')
      }))
      .filter((artist) => artist.name && artist.matchScore >= 0.55)
      .sort((a, b) => b.matchScore + Math.log10((b.listeners ?? 0) + 1) / 10 - (a.matchScore + Math.log10((a.listeners ?? 0) + 1) / 10));

    return ranked[0] ?? null;
  } catch (error) {
    warnings.push(`Last.fm search error for ${artistName}: ${error instanceof Error ? error.message : 'Unknown error'}.`);
    return null;
  }
}

export async function getLastFmProfile(
  artistName: string,
  warnings: string[]
): Promise<LastFmProfile | null> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return null;

  try {
    const tagsUrl = new URL('https://ws.audioscrobbler.com/2.0/');
    tagsUrl.searchParams.set('method', 'artist.getTopTags');
    tagsUrl.searchParams.set('artist', artistName);
    tagsUrl.searchParams.set('api_key', apiKey);
    tagsUrl.searchParams.set('format', 'json');

    const infoUrl = new URL('https://ws.audioscrobbler.com/2.0/');
    infoUrl.searchParams.set('method', 'artist.getInfo');
    infoUrl.searchParams.set('artist', artistName);
    infoUrl.searchParams.set('api_key', apiKey);
    infoUrl.searchParams.set('format', 'json');

    const [tagsResponse, infoResponse] = await Promise.all([
      fetch(tagsUrl),
      fetch(infoUrl)
    ]);

    const tagsData = (await tagsResponse.json()) as LastFmTopTagsResponse;
    const infoData = (await infoResponse.json()) as LastFmArtistInfoResponse;

    if (!tagsResponse.ok || tagsData.error) {
      if (!isLastFmArtistNotFound(tagsData.error, tagsData.message)) {
        warnings.push(tagsData.message ?? `Last.fm tags failed for ${artistName}.`);
      }
    }

    if (!infoResponse.ok || infoData.error) {
      if (!isLastFmArtistNotFound(infoData.error, infoData.message)) {
        warnings.push(infoData.message ?? `Last.fm artist info failed for ${artistName}.`);
      }
    }

    const genres = (tagsData.toptags?.tag ?? [])
      .map((tag) => tag.name)
      .filter((tag): tag is string => Boolean(tag))
      .slice(0, 5);

    const description = infoData.artist?.bio?.summary
      ? stripHtml(infoData.artist.bio.summary).split('. ').slice(0, 2).join('. ')
      : null;

    if (genres.length === 0 && !description) return null;

    return {
      genres,
      description
    };
  } catch (error) {
    warnings.push(
      `Last.fm error for ${artistName}: ${error instanceof Error ? error.message : 'Unknown error'}.`
    );
    return null;
  }
}
