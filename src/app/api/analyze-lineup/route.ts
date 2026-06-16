import { NextResponse } from 'next/server';
import { dedupeArtistNames, searchUrl } from '@/lib/artistUtils';
import { verifyArtistCandidates } from '@/lib/artistVerification';
import { demoArtists, getDemoAnalyzeResponse } from '@/lib/demoData';
import { getLastFmProfile } from '@/lib/lastfm';
import { extractArtistsFromOcrText } from '@/lib/ocrTextParser';
import type { AnalyzedArtist, AnalyzeLineupResponse, ExtractedArtist, VerifiedArtistCandidate } from '@/lib/types';
import { getYouTubeRecommendations } from '@/lib/youtube';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
    confidence: 0.98,
    rawTextMatch: name,
    stage: null,
    time: null,
    source: 'manual'
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

async function buildAnalyzedArtists(
  verifiedArtists: VerifiedArtistCandidate[],
  warnings: string[]
): Promise<AnalyzedArtist[]> {
  const artists: AnalyzedArtist[] = [];

  for (const verified of verifiedArtists) {
    const name = verified.name;
    const fallbackProfile = fallbackProfileFor(name);
    const lastFmProfile = await getLastFmProfile(name, warnings);
    const recommendations = await getYouTubeRecommendations(name, warnings);

    artists.push({
      name,
      confidence: verified.confidence,
      stage: verified.stage ?? null,
      time: verified.time ?? null,
      verification: verified.verification,
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

  return artists;
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
      warnings.push('Demo/mock mode is active. Set USE_MOCKS=false to use free browser OCR and database verification.');
      const mergedDemoArtists = mergeExtractedArtists(manualArtists, ocrArtists);
      if (mergedDemoArtists.length > 0) {
        const verified = await verifyArtistCandidates(mergedDemoArtists, warnings);
        return NextResponse.json({
          festivalName: null,
          artists: await buildAnalyzedArtists(verified.confirmed, warnings),
          reviewArtists: await buildAnalyzedArtists(verified.review, warnings),
          rejectedCandidates: verified.rejectedCandidates,
          warnings
        } satisfies AnalyzeLineupResponse);
      }
      return NextResponse.json(getDemoAnalyzeResponse(warnings));
    }

    const mergedArtists = mergeExtractedArtists(manualArtists, ocrArtists);

    if (ocrText && ocrArtists.length === 0) {
      warnings.push('Free OCR ran, but no likely artist-name candidates were detected. Try a cleaner screenshot or paste DJ names manually.');
    }

    if (mergedArtists.length > 0) {
      const verified = await verifyArtistCandidates(mergedArtists, warnings);
      const confirmedArtists = await buildAnalyzedArtists(verified.confirmed, warnings);
      const reviewArtists = await buildAnalyzedArtists(verified.review, warnings);

      warnings.push('Free OCR ran in the browser. Strong database matches are Confirmed, and plausible OCR names are kept as Potential DJs.');
      if (!process.env.LASTFM_API_KEY) {
        warnings.push('LASTFM_API_KEY is missing. This is okay; MusicBrainz and OCR heuristics are still used.');
      }

      if (confirmedArtists.length > 0 || reviewArtists.length > 0) {
        return NextResponse.json({
          festivalName: null,
          artists: confirmedArtists,
          reviewArtists,
          rejectedCandidates: verified.rejectedCandidates,
          warnings
        } satisfies AnalyzeLineupResponse);
      }

      return NextResponse.json(
        {
          festivalName: null,
          artists: [],
          reviewArtists: [],
          rejectedCandidates: verified.rejectedCandidates,
          warnings: [
            'OCR found text, but the parser only saw noise/date/stage-like text. Try a clearer image or paste DJ names manually.',
            ...warnings
          ]
        } satisfies AnalyzeLineupResponse,
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        festivalName: null,
        artists: [],
        reviewArtists: [],
        rejectedCandidates: [],
        warnings: ['No artist names were found. Upload a clearer lineup image or paste DJ names manually.']
      } satisfies AnalyzeLineupResponse,
      { status: 422 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        festivalName: null,
        artists: [],
        reviewArtists: [],
        rejectedCandidates: [],
        warnings: [error instanceof Error ? error.message : 'Unknown server error.']
      } satisfies AnalyzeLineupResponse,
      { status: 500 }
    );
  }
}
