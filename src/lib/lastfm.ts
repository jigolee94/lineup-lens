export type LastFmProfile = {
  genres: string[];
  description: string | null;
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

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
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
      fetch(tagsUrl, { next: { revalidate: 60 * 60 * 24 * 7 } }),
      fetch(infoUrl, { next: { revalidate: 60 * 60 * 24 * 7 } })
    ]);

    const tagsData = (await tagsResponse.json()) as LastFmTopTagsResponse;
    const infoData = (await infoResponse.json()) as LastFmArtistInfoResponse;

    if (!tagsResponse.ok || tagsData.error) {
      warnings.push(tagsData.message ?? `Last.fm tags failed for ${artistName}.`);
    }

    if (!infoResponse.ok || infoData.error) {
      warnings.push(infoData.message ?? `Last.fm artist info failed for ${artistName}.`);
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
