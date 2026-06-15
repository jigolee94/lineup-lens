import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const mockMode = process.env.USE_MOCKS !== 'false';

  return NextResponse.json({
    ok: true,
    app: 'Lineup Lens',
    mode: mockMode ? 'mock' : 'provider',
    providers: {
      youtube: Boolean(process.env.YOUTUBE_API_KEY),
      lastfm: Boolean(process.env.LASTFM_API_KEY),
      openaiVision: Boolean(process.env.OPENAI_API_KEY)
    }
  });
}
