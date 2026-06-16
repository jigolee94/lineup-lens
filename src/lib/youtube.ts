import type { Recommendation } from './types';
import { searchUrl } from './artistUtils';

type YouTubeSearchItem = {
  id?: {
    videoId?: string;
  };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: {
      default?: { url?: string };
      medium?: { url?: string };
      high?: { url?: string };
    };
  };
};

type YouTubeSearchResponse = {
  items?: YouTubeSearchItem[];
  error?: {
    message?: string;
  };
};

function fallbackRecommendations(artistName: string): Recommendation[] {
  return [
    {
      provider: 'youtube',
      title: `${artistName} DJ set`,
      url: searchUrl('youtube', `${artistName} DJ set`),
      thumbnailUrl: null,
      channelTitle: 'YouTube Search'
    },
    {
      provider: 'youtube',
      title: `${artistName} Boiler Room / live set`,
      url: searchUrl('youtube', `${artistName} Boiler Room live set`),
      thumbnailUrl: null,
      channelTitle: 'YouTube Search'
    }
  ];
}

export async function getYouTubeRecommendations(
  artistName: string,
  warnings: string[]
): Promise<Recommendation[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return fallbackRecommendations(artistName);
  }

  const queries = [
    `${artistName} DJ set`,
    `${artistName} Boiler Room live set`,
    `${artistName} official music`
  ];

  const results: Recommendation[] = [];

  for (const query of queries) {
    if (results.length >= 2) break;

    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', '2');
    url.searchParams.set('videoEmbeddable', 'true');
    url.searchParams.set('safeSearch', 'none');
    url.searchParams.set('key', apiKey);

    try {
      const response = await fetch(url);
      const data = (await response.json()) as YouTubeSearchResponse;

      if (!response.ok) {
        warnings.push(data.error?.message ?? `YouTube search failed for ${artistName}.`);
        continue;
      }

      for (const item of data.items ?? []) {
        const videoId = item.id?.videoId;
        if (!videoId) continue;

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        if (results.some((result) => result.url === videoUrl)) continue;

        results.push({
          provider: 'youtube',
          title: item.snippet?.title ?? `${artistName} on YouTube`,
          url: videoUrl,
          thumbnailUrl:
            item.snippet?.thumbnails?.high?.url ??
            item.snippet?.thumbnails?.medium?.url ??
            item.snippet?.thumbnails?.default?.url ??
            null,
          channelTitle: item.snippet?.channelTitle ?? null
        });

        if (results.length >= 2) break;
      }
    } catch (error) {
      warnings.push(
        `YouTube search error for ${artistName}: ${error instanceof Error ? error.message : 'Unknown error'}.`
      );
    }
  }

  if (results.length === 0) {
    return fallbackRecommendations(artistName);
  }

  return results.slice(0, 2);
}
