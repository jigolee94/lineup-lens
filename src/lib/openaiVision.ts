import { dedupeArtistNames, normalizeArtistName } from './artistUtils';
import type { ExtractedArtist } from './types';

type OpenAIContentItem = {
  type?: string;
  text?: string;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: OpenAIContentItem[];
  }>;
};

type VisionJson = {
  festivalName?: string | null;
  artists?: Array<{
    name?: string;
    confidence?: number;
    rawTextMatch?: string;
    stage?: string | null;
    time?: string | null;
  }>;
};

export type VisionExtractionResult = {
  festivalName: string | null;
  artists: ExtractedArtist[];
};

function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.75;
  return Math.max(0, Math.min(1, value));
}

function extractTextFromResponse(data: OpenAIResponse): string {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks: string[] = [];
  for (const outputItem of data.output ?? []) {
    for (const content of outputItem.content ?? []) {
      if (typeof content.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
}

function parseJsonFromModelText(text: string): VisionJson {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as VisionJson;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Vision model did not return JSON.');
    return JSON.parse(match[0]) as VisionJson;
  }
}

function normalizeExtractedArtists(rawArtists: VisionJson['artists']): ExtractedArtist[] {
  const names = dedupeArtistNames(
    (rawArtists ?? [])
      .map((artist) => normalizeArtistName(artist.name ?? ''))
      .filter(Boolean)
  ).slice(0, 30);

  return names.map((name) => {
    const raw = (rawArtists ?? []).find(
      (artist) => normalizeArtistName(artist.name ?? '').toLowerCase() === name.toLowerCase()
    );

    return {
      name,
      confidence: clampConfidence(raw?.confidence),
      rawTextMatch: raw?.rawTextMatch,
      stage: raw?.stage ?? null,
      time: raw?.time ?? null
    };
  });
}

export async function extractArtistsWithOpenAIVision(
  image: File,
  warnings: string[]
): Promise<VisionExtractionResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    warnings.push('OPENAI_API_KEY is missing, so real OCR is disabled.');
    return null;
  }

  if (!image.type.startsWith('image/')) {
    warnings.push('Uploaded file is not an image.');
    return null;
  }

  const maxImageBytes = 8 * 1024 * 1024;
  if (image.size > maxImageBytes) {
    warnings.push('Image is larger than 8MB. Please upload a smaller screenshot.');
    return null;
  }

  const arrayBuffer = await image.arrayBuffer();
  const base64Image = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = image.type || 'image/jpeg';
  const model = process.env.OPENAI_VISION_MODEL || 'gpt-5.5';

  const prompt = `You are analyzing a festival lineup or timetable screenshot. Extract only DJ/artist names from the image.

Return strict JSON only, with this exact shape:
{
  "festivalName": string | null,
  "artists": [
    {
      "name": string,
      "confidence": number,
      "rawTextMatch": string,
      "stage": string | null,
      "time": string | null
    }
  ]
}

Rules:
- Include DJs, live acts, bands, or artists that appear in the lineup.
- Ignore dates, cities, venues, prices, ticket text, slogans, sponsors, URLs, stage labels alone, and decorative text.
- Preserve artist spelling as shown, including punctuation such as Fred again.. if visible.
- If a time or stage is clearly associated with the artist, include it.
- Return at most 30 artists.
- If unsure, use lower confidence.
- Do not include any explanation outside JSON.`;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              {
                type: 'input_image',
                image_url: `data:${mimeType};base64,${base64Image}`
              }
            ]
          }
        ],
        max_output_tokens: 1200
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      warnings.push(`OpenAI Vision OCR failed: ${response.status} ${errorText.slice(0, 160)}`);
      return null;
    }

    const data = (await response.json()) as OpenAIResponse;
    const modelText = extractTextFromResponse(data);
    const parsed = parseJsonFromModelText(modelText);
    const artists = normalizeExtractedArtists(parsed.artists);

    if (artists.length === 0) {
      warnings.push('OpenAI Vision ran, but no artist names were found.');
      return {
        festivalName: parsed.festivalName ?? null,
        artists: []
      };
    }

    return {
      festivalName: parsed.festivalName ?? null,
      artists
    };
  } catch (error) {
    warnings.push(error instanceof Error ? `OpenAI Vision OCR error: ${error.message}` : 'OpenAI Vision OCR error.');
    return null;
  }
}
