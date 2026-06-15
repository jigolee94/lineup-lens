import { NextResponse } from 'next/server';
import { dedupeArtistNames, searchUrl } from '@/lib/artistUtils';
import { demoArtists, getDemoAnalyzeResponse } from '@/lib/demoData';
import { getLastFmProfile } from '@/lib/lastfm';
import { extractArtistNamesFromImage } from '@/lib/ocr';
import type { AnalyzedArtist, AnalyzeLineupResponse } from '@/lib/types';
import { getYouTubeRecommendations } from '@/lib/youtube';

export const runtime = 'nodejs';
export const maxDuration = 30;

type FormFields = {
  demoRequested: boolean;
  artistNames: string[];
  imageFile: File | null;
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
      imageFile: null
    };
  }

  const formData = await request.formData();
  const image = formData.get('image');
  const demo = formData.get('demo');
  const artistNames = formData.get('artistNames');

  return {
    demoRequested: demo === 'true',
    artistNames: parseArtistNames(typeof artistNames === 'string' ? artistNames : null),
    imageFile: image instanceof File && image.size > 0 ? image : null
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

async function resolveArtistNamesFromInput(
  artistNames: string[],
  imageFile: File | null,
  warnings: string[]
): Promise<string[]> {
  if (!imageFile) return artistNames;

  const ocrNames = await extractArtistNamesFromImage(imageFile, warnings);
  return dedupeArtistNames([...artistNames, ...ocrNames]).slice(0, 30);
}

async function buildResponseForArtistNames(
  artistNames: string[],
  warnings: string[]
): Promise<AnalyzeLineupResponse> {
  const artists: AnalyzedArtist[] = [];

  for (const name of artistNames.slice(0, 30)) {
    const fallbackProfile = fallbackProfileFor(name);
    const lastFmProfile = await getLastFmProfile(name, warnings);
    const recommendations = await getYouTubeRecommendations(name, warnings);

    artists.push({
      name,
      confidence: 0.9,
      stage: null,
      time: null,
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
    festivalName: null,
    artists,
    warnings
  };
}

export async function POST(request: Request) {
  const warnings: string[] = [];

  try {
    const { demoRequested, artistNames, imageFile } = await readFormFields(request);
    const useMocks = process.env.USE_MOCKS !== 'false';

    if (demoRequested) {
      return NextResponse.json(getDemoAnalyzeResponse(warnings));
    }

    const resolvedArtistNames = await resolveArtistNamesFromInput(artistNames, imageFile, warnings);

    if (resolvedArtistNames.length > 0) {
      return NextResponse.json(await buildResponseForArtistNames(resolvedArtistNames, warnings));
    }

    if (useMocks) {
      return NextResponse.json(getDemoAnalyzeResponse(warnings));
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
