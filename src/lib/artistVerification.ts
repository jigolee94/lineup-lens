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

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function addSource(sources: VerificationSource[], source: VerificationSource) {
  if (!sources.includes(source)) sources.push(source);
}

function baseHeuristicScore(candidate: ExtractedArtist): { score: number; reasons: string[] } {
  const name = candidate.name.trim();
  const comparable = comparableName(name);
  let score = Math.round((candidate.confidence || 0.6) * 20);
  const reasons: string[] = ['OCR text looks like a possible artist name.'];

  const words = comparable.split(' ').filter(Boolean);
  if (words.length >= 1 && words.length <= 4) {
    score += 10;
    reasons.push('Name length/word count looks plausible.');
  }

  if (/[A-Z]/.test(name[0] ?? '') || name.includes('.') || name.includes('&')) {
    score += 5;
    reasons.push('Artist-style spelling or punctuation detected.');
  }

  if (words.length === 1 && words[0].length <= 3) {
    score -= 12;
    reasons.push('Very short one-word names need stronger database proof.');
  }

  if (/^[+\-_=~*#\d\s]+$/.test(name) || (name.match(/[+_]/g) ?? []).length >= 2) {
    score -= 50;
    reasons.push('Looks like OCR noise rather than a name.');
  }

  return { score, reasons };
}

function hasElectronicHint(text: string | null | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return ELECTRONIC_HINTS.some((hint) => lower.includes(hint));
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
    score = 100;
    reasons.push('User entered this name manually, so it is treated as confirmed.');
    return {
      ...candidate,
      verification: {
        status: 'confirmed',
        score,
        sources,
        reasons,
        matchedName: candidate.name,
        musicBrainzId,
        lastFmUrl
      }
    };
  }

  const heuristic = baseHeuristicScore(candidate);
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
      score += 38;
      reasons.push(`MusicBrainz has a strong artist match: ${musicBrainzMatch.name}.`);
    } else if (musicBrainzMatch.matchScore >= 0.72) {
      score += 26;
      reasons.push(`MusicBrainz has a related artist match: ${musicBrainzMatch.name}.`);
    } else {
      score += 14;
      reasons.push(`MusicBrainz has a weak artist match: ${musicBrainzMatch.name}.`);
    }

    if (musicBrainzMatch.score >= 80) score += 12;
    else if (musicBrainzMatch.score >= 60) score += 7;

    const tagText = musicBrainzMatch.tags.join(' ');
    if (hasElectronicHint(tagText) || hasElectronicHint(musicBrainzMatch.disambiguation)) {
      score += 12;
      reasons.push('MusicBrainz metadata suggests DJ/electronic music relevance.');
    }
  }

  if (lastFmMatch) {
    addSource(sources, 'lastfm');
    lastFmUrl = lastFmMatch.url;
    matchedName = matchedName ?? lastFmMatch.name;

    if (lastFmMatch.matchScore >= 0.92) {
      score += 35;
      reasons.push(`Last.fm has a strong artist match: ${lastFmMatch.name}.`);
    } else if (lastFmMatch.matchScore >= 0.72) {
      score += 22;
      reasons.push(`Last.fm has a related artist match: ${lastFmMatch.name}.`);
    } else {
      score += 10;
      reasons.push(`Last.fm has a weak artist match: ${lastFmMatch.name}.`);
    }

    if ((lastFmMatch.listeners ?? 0) > 10000) score += 8;
    else if ((lastFmMatch.listeners ?? 0) > 1000) score += 4;
  }

  const finalScore = clampScore(score);
  const status = finalScore >= 70 ? 'confirmed' : finalScore >= 45 ? 'review' : null;
  if (!status) return null;

  return {
    ...candidate,
    verification: {
      status,
      score: finalScore,
      sources,
      reasons: reasons.slice(0, 5),
      matchedName,
      musicBrainzId,
      lastFmUrl
    }
  };
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

  // Keep this capped so one messy poster does not trigger too many external checks.
  const cappedCandidates = candidates.slice(0, 18);

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
