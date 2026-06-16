import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const mockMode = process.env.USE_MOCKS === 'true';

  return NextResponse.json({
    ok: true,
    app: 'Lineup Lens',
    mode: mockMode ? 'mock' : 'free-ocr-with-db-verification',
    providers: {
      browserOcr: 'tesseract.js',
      musicBrainz: true,
      lastfm: Boolean(process.env.LASTFM_API_KEY),
      youtube: Boolean(process.env.YOUTUBE_API_KEY)
    }
  });
}
