import { NextResponse } from 'next/server';
import { dedupeArtistNames, searchUrl } from '@/lib/artistUtils';
import { demoArtists, getDemoAnalyzeResponse } from '@/lib/demoData';
import { getLastFmProfile } from '@/lib/lastfm';
import { extractArtistsWithOpenAIVision } from '@/lib/openaiVision';
import type { AnalyzedArtist, AnalyzeLineupResponse, ExtractedArtist } from '@/lib/types';
import { getYouTubeRecommendations } from '@/lib/youtube';

export const runtime = 'nodejs';
export const maxDuration = 30;

type FormFields = {
  demoRequested: boolean;
  artistNames: string[];
  image: File | null;
};

function parseArtistNames(raw: string | null): string[] {
  if (!raw) return [];
  return dedupeArtistNames(
    raw
      .split(/[\n,;/]+/g)
      .map((item) => item.trim())
      .filter(Boolean)
  ).slice(0, 30);
}

async function readFormFields(request: Request): Promise<FormFields> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as {
      demo?: boolean;
      artistNames?: string[] | string;
    };

    const rawArtistNames = Array.isArray(body.artistNames)
      ? body.artistNames.join('\n')
      : body.artistNames ?? null;

    return {
      demoRequested: body.demo === true,
      artistNames: parseArtistNames(rawArtistNames),
      image: null
    };
  }

  const formData = await request.formData();
  const image = formData.get('image');
  const demo = formData.get('demo');
  const artistNames = formData.get('artistNames');

  return {
    demoRequested: demo === 'true',
    artistNames: parseArtistNames(typeof artistNames === 'string' ? artistNames : null),
    image: image instanceof File && image.size > 0 ? image : null
  };
}

function fallbackProfileFor(name: string): AnalyzedArtist['profile'] {
  const demo = demoArtists.find((artist) => artist.name.toLowerCase() === name.toLowerCase());
  if (demo) return demo.profile;

  return {
    description: 'Artist profile is not enriched yet. Open the music links to quickly check their sound.',
    genres: ['Electronic', 'DJ'],
    imageUrl: null,
    externalLinks: {
      youtubeSearch: searchUrl('youtube', name),
      soundcloudSearch: searchUrl('soundcloud', name),
      spotifySearch: searchUrl('spotify', name)
    }
  };
}

function extractedFromNames(names: string[]): ExtractedArtist[] {
  return names.map((name) => ({
    name,
    confidence: 0.9,
    rawTextMatch: name,
    stage: null,
    time: null
  }));
}

function mergeExtractedArtists(...groups: ExtractedArtist[][]): ExtractedArtist[] {
  const seen = new Set<string>();
  const output: ExtractedArtist[] = [];

  for (const group of groups) {
    for (const artist of group) {
      const key = artist.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(artist);
    }
  }

  return output.slice(0, 30);
}

async function buildResponseForExtractedArtists(
  extractedArtists: ExtractedArtist[],
  warnings: string[],
  festivalName: string | null = null
): Promise<AnalyzeLineupResponse> {
  const artists: AnalyzedArtist[] = [];

  for (const extracted of extractedArtists.slice(0, 30)) {
    const name = extracted.name;
    const fallbackProfile = fallbackProfileFor(name);
    const lastFmProfile = await getLastFmProfile(name, warnings);
    const recommendations = await getYouTubeRecommendations(name, warnings);

    artists.push({
      name,
      confidence: extracted.confidence,
      stage: extracted.stage ?? null,
      time: extracted.time ?? null,
      profile: {
        ...fallbackProfile,
        description: lastFmProfile?.description ?? fallbackProfile.description,
        genres:
          lastFmProfile?.genres && lastFmProfile.genres.length > 0
            ? lastFmProfile.genres
            : fallbackProfile.genres
      },
      recommendations
    });
  }

  return {
    festivalName,
    artists,
    warnings
  };
}

export async function POST(request: Request) {
  const warnings: string[] = [];

  try {
    const { demoRequested, artistNames, image } = await readFormFields(request);
    const useMocks = process.env.USE_MOCKS !== 'false';
    const manualArtists = extractedFromNames(artistNames);

    if (demoRequested) {
      return NextResponse.json(getDemoAnalyzeResponse(warnings));
    }

    if (useMocks) {
      if (image) {
        warnings.push('Image upload was received, but USE_MOCKS=true. Returning demo results. Set USE_MOCKS=false and OPENAI_API_KEY to enable OCR.');
      }
      if (manualArtists.length > 0) {
        return NextResponse.json(await buildResponseForExtractedArtists(manualArtists, warnings));
      }
      return NextResponse.json(getDemoAnalyzeResponse(warnings));
    }

    let visionFestivalName: string | null = null;
    let visionArtists: ExtractedArtist[] = [];

    if (image) {
      const visionResult = await extractArtistsWithOpenAIVision(image, warnings);
      visionFestivalName = visionResult?.festivalName ?? null;
      visionArtists = visionResult?.artists ?? [];
    }

    const mergedArtists = mergeExtractedArtists(manualArtists, visionArtists);

    if (mergedArtists.length > 0) {
      return NextResponse.json(await buildResponseForExtractedArtists(mergedArtists, warnings, visionFestivalName));
    }

    if (image) {
      warnings.push('No artist names were extracted from the image. Try a clearer screenshot or paste DJ names manually.');
      return NextResponse.json(
        {
          festivalName: visionFestivalName,
          artists: [],
          warnings
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        festivalName: null,
        artists: [],
        warnings: ['No image or artist names were provided.']
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        festivalName: null,
        artists: [],
        warnings: [error instanceof Error ? error.message : 'Unknown server error.']
      },
      { status: 500 }
    );
  }
}
