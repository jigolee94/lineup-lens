import { dedupeArtistNames, normalizeArtistName } from './artistUtils';
import type { ExtractedArtist } from './types';

const BLOCKED_PATTERNS = [
  /festival/i,
  /lineup/i,
  /tickets?/i,
  /presented by/i,
  /sponsored by/i,
  /instagram/i,
  /follow/i,
  /www\./i,
  /https?:\/\//i,
  /doors?/i,
  /open/i,
  /stage$/i,
  /^stage\b/i,
  /parking/i,
  /venue/i,
  /location/i,
  /address/i,
  /info/i,
  /after\s*party/i,
  /time\s*table/i,
  /timetable/i,
  /schedule/i,
  /main stage/i,
  /sunset stage/i,
  /warehouse/i,
  /garden/i,
  /live stage/i,
  /buy now/i,
  /available/i,
  /entry/i,
  /gate/i,
  /club/i,
  /arena/i,
  /official/i,
  /hosted by/i,
  /powered by/i,
  /early bird/i,
  /limited/i,
  /reservation/i
];

function removeTimesAndDates(input: string): string {
  return input
    .replace(/\b\d{1,2}[:.]\d{2}\s*(AM|PM)?\b/gi, ' ')
    .replace(/\b\d{1,2}\s*(AM|PM)\b/gi, ' ')
    .replace(/\b\d{4}[./-]\d{1,2}[./-]\d{1,2}\b/g, ' ')
    .replace(/\b\d{1,2}[./-]\d{1,2}\b/g, ' ')
    .replace(/\b(MON|TUE|WED|THU|FRI|SAT|SUN)\b/gi, ' ')
    .replace(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)\b/gi, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitIntoChunks(text: string): string[] {
  return text
    .replace(/[\t]+/g, ' ')
    .replace(/[•·▪■◆★☆]/g, '\n')
    .split(/\r?\n+/)
    .flatMap((line) => line.split(/[;,]|\s{2,}|\s\/\s|\s\|\s/g))
    .map((item) => item.trim())
    .filter(Boolean);
}

function looksBlocked(text: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(text));
}

function likelyArtistChunk(chunk: string): boolean {
  if (!chunk) return false;
  if (chunk.length < 2) return false;
  if (chunk.length > 48) return false;
  if (looksBlocked(chunk)) return false;
  if (!/[A-Za-z]/.test(chunk)) return false;
  if (/^[^A-Za-z]*$/.test(chunk)) return false;
  if (/^[+\-_=~*#\s]+$/.test(chunk)) return false;
  if ((chunk.match(/[+_]/g) ?? []).length >= 2) return false;

  const words = chunk.split(/\s+/).filter(Boolean);
  if (words.length > 5) return false;

  const letters = (chunk.match(/[A-Za-z]/g) ?? []).length;
  if (letters < 2) return false;

  return true;
}

export function extractArtistsFromOcrText(text: string): ExtractedArtist[] {
  if (!text.trim()) return [];

  const cleanedChunks = splitIntoChunks(text)
    .map((chunk) => removeTimesAndDates(chunk))
    .map((chunk) => normalizeArtistName(chunk))
    .filter(Boolean)
    .filter(likelyArtistChunk);

  const names = dedupeArtistNames(cleanedChunks).slice(0, 24);

  return names.map((name) => ({
    name,
    confidence: 0.72,
    rawTextMatch: name,
    stage: null,
    time: null,
    source: 'ocr'
  }));
}
