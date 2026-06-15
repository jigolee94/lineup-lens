import { NextResponse } from 'next/server';
import { dedupeArtistNames, searchUrl } from '@/lib/artistUtils';
import { demoArtists, getDemoAnalyzeResponse } from '@/lib/demoData';
import { getLastFmProfile } from '@/lib/lastfm';
import { extractArtistsFromOcrText } from '@/lib/ocrTextParser';
import type { AnalyzedArtist, AnalyzeLineupResponse, ExtractedArtist } from '@/lib/types';
import { getYouTubeRecommendations } from '@/lib/youtube';

export const runtime = 'nodejs';
export const maxDuration = 30;

type FormFields = {
  demoRequested: boolean;
  artistNames: string[];
  ocrText: string | null;
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
      ocrText?: string;
    };

    const rawArtistNames = Array.isArray(body.artistNames)
      ? body.artistNames.join('\n')
      : body.artistNames ?? null;

    return {
      demoRequested: body.demo === true,
      artistNames: parseArtistNames(rawArtistNames),
      ocrText: typeof body.ocrText === 'string' ? body.ocrText : null
    };
  }

  const formData = await request.formData();
  const demo = formData.get('demo');
  const artistNames = formData.get('artistNames');
  const ocrText = formData.get('ocrText');

  return {
    demoRequested: demo === 'true',
    artistNames: parseArtistNames(typeof artistNames === 'string' ? artistNames : null),
    ocrText: typeof ocrText === 'string' ? ocrText : null
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
    confidence: 0.95,
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
    const { demoRequested, artistNames, ocrText } = await readFormFields(request);
    const useMocks = process.env.USE_MOCKS === 'true';
    const manualArtists = extractedFromNames(artistNames);
    const ocrArtists = ocrText ? extractArtistsFromOcrText(ocrText) : [];

    if (demoRequested) {
      return NextResponse.json(getDemoAnalyzeResponse(warnings));
    }

    if (useMocks) {
      warnings.push('Demo/mock mode is active. Set USE_MOCKS=false to use free browser OCR results.');
      const mergedDemoArtists = mergeExtractedArtists(manualArtists, ocrArtists);
      if (mergedDemoArtists.length > 0) {
        return NextResponse.json(await buildResponseForExtractedArtists(mergedDemoArtists, warnings));
      }
      return NextResponse.json(getDemoAnalyzeResponse(warnings));
    }

    const mergedArtists = mergeExtractedArtists(manualArtists, ocrArtists);

    if (ocrText && ocrArtists.length === 0) {
      warnings.push('Free OCR ran, but no likely artist names were detected. Try a cleaner screenshot or paste DJ names manually.');
    }

    if (mergedArtists.length > 0) {
      warnings.push('Free OCR is running locally in your browser using Tesseract.js. Accuracy may vary depending on the lineup image.');
      return NextResponse.json(await buildResponseForExtractedArtists(mergedArtists, warnings));
    }

    return NextResponse.json(
      {
        festivalName: null,
        artists: [],
        warnings: ['No artist names were found. Upload a clearer lineup image or paste DJ names manually.']
      },
      { status: 422 }
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
