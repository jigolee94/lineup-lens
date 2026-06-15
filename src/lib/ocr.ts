import { createWorker } from 'tesseract.js';
import { dedupeArtistNames, normalizeArtistName } from './artistUtils';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const STOP_PHRASES = [
  'lineup',
  'festival',
  'tickets',
  'ticket',
  'passes',
  'presale',
  'general admission',
  'vip',
  'doors',
  'venue',
  'stage',
  'main stage',
  'presented by',
  'presents',
  'official',
  'sponsor',
  'sponsored',
  'friday',
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
  'www',
  'http',
  '.com',
  '@'
];

const SPLIT_PATTERN = /(?:\s+\/\s+|\s*\/{2,}\s*|\s*\|+\s*|\s*[\u2022\u00b7;]\s*|\s{3,})/g;

export async function extractArtistNamesFromImage(file: File, warnings: string[]): Promise<string[]> {
  if (!file.type.startsWith('image/')) {
    warnings.push('Uploaded file is not an image.');
    return [];
  }

  if (file.size > MAX_IMAGE_BYTES) {
    warnings.push('Image is larger than 8 MB. Try a smaller screenshot for OCR.');
    return [];
  }

  const worker = await createWorker('eng');

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await worker.recognize(buffer);
    const text = result.data.text ?? '';
    const names = extractArtistNamesFromText(text);

    if (!text.trim()) {
      warnings.push('OCR did not find readable text in the image.');
    } else if (!names.length) {
      warnings.push('OCR read the image, but no likely DJ names were found.');
    }

    return names;
  } catch (error) {
    warnings.push(error instanceof Error ? `OCR failed: ${error.message}` : 'OCR failed.');
    return [];
  } finally {
    await worker.terminate();
  }
}

export function extractArtistNamesFromText(text: string): string[] {
  if (!text.trim()) return [];

  const candidates = text
    .replace(/\r/g, '\n')
    .split('\n')
    .flatMap(splitOcrLine)
    .map(cleanCandidate)
    .filter(Boolean)
    .filter(isLikelyDjName);

  return dedupeArtistNames(candidates).slice(0, 30);
}

function splitOcrLine(line: string): string[] {
  const original = line.trim();
  if (!original) return [];

  return original
    .split(SPLIT_PATTERN)
    .flatMap(splitDenseLine)
    .map((part) => part.replace(/\s+/g, ' ').trim());
}

function splitDenseLine(line: string): string[] {
  if (line.length < 32) return [line];

  return line
    .replace(/\s+-\s+/g, ' | ')
    .replace(/\s+\u2014\s+/g, ' | ')
    .replace(/\s+\u2013\s+/g, ' | ')
    .split(/\s\|\s/g);
}

function cleanCandidate(candidate: string): string {
  return normalizeArtistName(
    candidate
      .replace(/[\u201c\u201d"[\]{}<>]/g, '')
      .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})!?]+$/gu, '')
      .replace(/\s*\((?:dj set|live|set)\)\s*$/i, '')
      .replace(/\b(?:live|dj set|set)\b$/i, '')
      .trim()
  );
}

function isLikelyDjName(candidate: string): boolean {
  if (candidate.length < 2 || candidate.length > 64) return false;
  if (!/\p{L}/u.test(candidate)) return false;
  if ((candidate.match(/\d/g) ?? []).length > candidate.length / 3) return false;
  if (/^[A-Z]\s+[A-Z]\s+[A-Z](?:\s+[A-Z])?$/.test(candidate)) return false;
  if (/\b20\d{2}\b/.test(candidate)) return false;
  if (/^\d{1,2}[./-]\d{1,2}/.test(candidate)) return false;
  if (/^\d{4}$/.test(candidate)) return false;
  if (candidate.split(/\s+/).length > 7) return false;

  const lower = candidate.toLowerCase();
  if (STOP_PHRASES.some((phrase) => lower.includes(phrase))) return false;

  const letters = candidate.match(/\p{L}/gu) ?? [];
  return letters.length / candidate.length >= 0.45;
}
