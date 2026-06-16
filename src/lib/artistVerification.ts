import { comparableName } from './artistUtils';
import { searchLastFmArtist } from './lastfm';
import { searchMusicBrainzArtist } from './musicBrainz';
import type { ArtistVerification, ExtractedArtist, VerificationSource, VerifiedArtistCandidate } from './types';

const ELECTRONIC_HINTS = [
  'dj',
  'electronic',
  'house',
  'techno',
  'trance',
  'edm',
  'dance',
  'producer',
  'disco',
  'garage',
  'dubstep',
  'drum and bass',
  'ambient',
  'electro'
];

const HARD_REJECT_PATTERNS = [
  /^[+\-_=~*#\d\s]+$/,
  /\b(ticket|tickets|lineup|festival|stage|timetable|schedule|doors|venue|address|parking|sponsor|instagram|www\.|http)\b/i,
  /^\d{1,2}[:.]\d{2}/,
  /^\d{4}[./-]/,
  /^[A-Z]{1}$/
];

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function addSource(sources: VerificationSource[], source: VerificationSource) {
  if (!sources.includes(source)) sources.push(source);
}

function looksLikeHardReject(name: string): boolean {
  const comparable = comparableName(name);
  if (!comparable) return true;
  if (name.length < 2) return true;
  if ((name.match(/[+_]/g) ?? []).length >= 2) return true;
  if (!/[A-Za-z]/.test(name)) return true;
  return HARD_REJECT_PATTERNS.some((pattern) => pattern.test(name));
}

function baseHeuristicScore(candidate: ExtractedArtist): { score: number; reasons: string[]; hardReject: boolean } {
  const name = candidate.name.trim();
  const comparable = comparableName(name);
  const words = comparable.split(' ').filter(Boolean);
  let score = Math.round((candidate.confidence || 0.6) * 30);
  const reasons: string[] = ['OCR text looks like a possible artist name.'];

  if (looksLikeHardReject(name)) {
    return {
      score: 0,
      reasons: ['Looks like OCR noise or non-artist festival text.'],
      hardReject: true
    };
  }

  if (words.length >= 1 && words.length <= 4) {
    score += 18;
    reasons.push('Name length/word count looks plausible for an artist.');
  }

  if (words.length === 2 || words.length === 3) {
    score += 8;
    reasons.push('Two or three word names are common artist-name shapes.');
  }

  if (/[A-Z]/.test(name[0] ?? '') || name.includes('.') || name.includes('&') || name.includes('-')) {
    score += 8;
    reasons.push('Artist-style spelling or punctuation detected.');
  }

  if (/[a-z][A-Z]/.test(name) || /\b[A-Z][a-z]+/.test(name)) {
    score += 6;
    reasons.push('Capitalization looks like a name.');
  }

  if (words.length === 1 && words[0].length <= 3) {
    score -= 10;
    reasons.push('Very short one-word names are kept for review only unless a database confirms them.');
  }

  if (words.length > 5) {
    score -= 30;
    reasons.push('Long text fragment is less likely to be a DJ name.');
  }

  return { score, reasons, hardReject: false };
}

function hasElectronicHint(text: string | null | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return ELECTRONIC_HINTS.some((hint) => lower.includes(hint));
}

function makeVerification(
  candidate: ExtractedArtist,
  status: ArtistVerification['status'],
  score: number,
  sources: VerificationSource[],
  reasons: string[],
  matchedName: string | null,
  musicBrainzId: string | null,
  lastFmUrl: string | null
): VerifiedArtistCandidate {
  return {
    ...candidate,
    verification: {
      status,
      score: clampScore(score),
      sources,
      reasons: reasons.slice(0, 5),
      matchedName,
      musicBrainzId,
      lastFmUrl
    }
  };
}

export async function verifyArtistCandidate(
  candidate: ExtractedArtist,
  warnings: string[]
): Promise<VerifiedArtistCandidate | null> {
  const sources: VerificationSource[] = [];
  const reasons: string[] = [];
  let score = 0;
  let matchedName: string | null = null;
  let musicBrainzId: string | null = null;
  let lastFmUrl: string | null = null;

  if (candidate.source === 'manual') {
    addSource(sources, 'manual');
    return makeVerification(
      candidate,
      'confirmed',
      100,
      sources,
      ['User entered this name manually, so it is treated as confirmed.'],
      candidate.name,
      musicBrainzId,
      lastFmUrl
    );
  }

  const heuristic = baseHeuristicScore(candidate);
  if (heuristic.hardReject) return null;

  score += heuristic.score;
  reasons.push(...heuristic.reasons);
  addSource(sources, 'heuristic');

  const [musicBrainzMatch, lastFmMatch] = await Promise.all([
    searchMusicBrainzArtist(candidate.name, warnings),
    searchLastFmArtist(candidate.name, warnings)
  ]);

  if (musicBrainzMatch) {
    addSource(sources, 'musicbrainz');
    musicBrainzId = musicBrainzMatch.id;
    matchedName = musicBrainzMatch.name;

    if (musicBrainzMatch.matchScore >= 0.92) {
      score += 34;
      reasons.push(`MusicBrainz has a strong artist match: ${musicBrainzMatch.name}.`);
    } else if (musicBrainzMatch.matchScore >= 0.72) {
      score += 22;
      reasons.push(`MusicBrainz has a related artist match: ${musicBrainzMatch.name}.`);
    } else {
      score += 10;
      reasons.push(`MusicBrainz has a weak artist match: ${musicBrainzMatch.name}.`);
    }

    if (musicBrainzMatch.score >= 80) score += 8;
    else if (musicBrainzMatch.score >= 60) score += 4;

    const tagText = musicBrainzMatch.tags.join(' ');
    if (hasElectronicHint(tagText) || hasElectronicHint(musicBrainzMatch.disambiguation)) {
      score += 10;
      reasons.push('MusicBrainz metadata suggests DJ/electronic music relevance.');
    }
  }

  if (lastFmMatch) {
    addSource(sources, 'lastfm');
    lastFmUrl = lastFmMatch.url;
    matchedName = matchedName ?? lastFmMatch.name;

    if (lastFmMatch.matchScore >= 0.92) {
      score += 32;
      reasons.push(`Last.fm has a strong artist match: ${lastFmMatch.name}.`);
    } else if (lastFmMatch.matchScore >= 0.72) {
      score += 20;
      reasons.push(`Last.fm has a related artist match: ${lastFmMatch.name}.`);
    } else {
      score += 8;
      reasons.push(`Last.fm has a weak artist match: ${lastFmMatch.name}.`);
    }

    if ((lastFmMatch.listeners ?? 0) > 10000) score += 6;
    else if ((lastFmMatch.listeners ?? 0) > 1000) score += 3;
  }

  const hasDatabaseSignal = sources.includes('musicbrainz') || sources.includes('lastfm');
  const finalScore = clampScore(score);

  // Important product decision:
  // Do NOT throw away plausible OCR names just because they are not in MusicBrainz/Last.fm.
  // Underground/local DJs often do not exist in those databases.
  if (hasDatabaseSignal && finalScore >= 55) {
    return makeVerification(candidate, 'confirmed', finalScore, sources, reasons, matchedName, musicBrainzId, lastFmUrl);
  }

  if (finalScore >= 25) {
    reasons.push('No strong database proof, but the text still looks like a plausible artist name. Kept for review instead of hiding it.');
    return makeVerification(candidate, 'review', finalScore, sources, reasons, matchedName, musicBrainzId, lastFmUrl);
  }

  return null;
}

export async function verifyArtistCandidates(
  candidates: ExtractedArtist[],
  warnings: string[]
): Promise<{
  confirmed: VerifiedArtistCandidate[];
  review: VerifiedArtistCandidate[];
  rejectedCandidates: string[];
}> {
  const confirmed: VerifiedArtistCandidate[] = [];
  const review: VerifiedArtistCandidate[] = [];
  const rejectedCandidates: string[] = [];

  // More permissive cap: lineup posters can contain many names.
  const cappedCandidates = candidates.slice(0, 40);

  for (const candidate of cappedCandidates) {
    const verified = await verifyArtistCandidate(candidate, warnings);
    if (!verified) {
      rejectedCandidates.push(candidate.name);
      continue;
    }

    if (verified.verification.status === 'confirmed') confirmed.push(verified);
    else review.push(verified);
  }

  return { confirmed, review, rejectedCandidates };
}
