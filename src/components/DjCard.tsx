'use client';

import type { AnalyzedArtist } from '@/lib/types';

type DjCardProps = {
  artist: AnalyzedArtist;
  isSaved: boolean;
  onToggleSave: (artist: AnalyzedArtist) => void;
};

function sourceLabel(source: string): string {
  if (source === 'musicbrainz') return 'MusicBrainz';
  if (source === 'lastfm') return 'Last.fm';
  if (source === 'manual') return 'Manual';
  return 'Heuristic';
}

export function DjCard({ artist, isSaved, onToggleSave }: DjCardProps) {
  const confidencePercent = Math.round(artist.confidence * 100);
  const verification = artist.verification;
  const statusLabel = verification?.status === 'review' ? 'Needs review' : 'Confirmed';

  return (
    <article className={verification?.status === 'review' ? 'dj-card dj-card--review' : 'dj-card'}>
      <div className="dj-card__top">
        <div>
          <p className="eyebrow">DJ / Artist</p>
          <h3>{artist.name}</h3>
        </div>
        <button className={isSaved ? 'save-button save-button--saved' : 'save-button'} onClick={() => onToggleSave(artist)}>
          {isSaved ? 'Saved' : 'Save'}
        </button>
      </div>

      <div className="meta-row">
        <span>{confidencePercent}% OCR</span>
        {verification ? <span>{verification.score}/100 DB score</span> : null}
        {artist.stage ? <span>{artist.stage}</span> : null}
        {artist.time ? <span>{artist.time}</span> : null}
      </div>

      {verification ? (
        <div className={verification.status === 'review' ? 'verification verification--review' : 'verification'}>
          <div className="verification__top">
            <strong>{statusLabel}</strong>
            <span>{verification.sources.map(sourceLabel).join(' + ')}</span>
          </div>
          {verification.matchedName && verification.matchedName !== artist.name ? (
            <p>Matched as: {verification.matchedName}</p>
          ) : null}
          {verification.reasons.length ? <p>{verification.reasons.slice(0, 2).join(' ')}</p> : null}
        </div>
      ) : null}

      {artist.profile.description ? <p className="description">{artist.profile.description}</p> : null}

      <div className="chip-row">
        {artist.profile.genres.map((genre) => (
          <span className="chip" key={`${artist.name}-${genre}`}>
            {genre}
          </span>
        ))}
      </div>

      <div className="recommendations">
        <p className="section-label">Listen first</p>
        {artist.recommendations.map((recommendation) => (
          <a className="recommendation" href={recommendation.url} target="_blank" rel="noreferrer" key={recommendation.url}>
            {recommendation.thumbnailUrl ? (
              // Plain img keeps the app dependency-free and accepts dynamic YouTube thumbnails.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={recommendation.thumbnailUrl} alt="" />
            ) : (
              <div className="thumb-placeholder">▶</div>
            )}
            <div>
              <strong>{recommendation.title}</strong>
              <span>{recommendation.channelTitle ?? 'YouTube'}</span>
            </div>
          </a>
        ))}
      </div>

      <div className="link-row">
        <a href={artist.profile.externalLinks.youtubeSearch} target="_blank" rel="noreferrer">
          YouTube
        </a>
        <a href={artist.profile.externalLinks.soundcloudSearch} target="_blank" rel="noreferrer">
          SoundCloud
        </a>
        <a href={artist.profile.externalLinks.spotifySearch} target="_blank" rel="noreferrer">
          Spotify
        </a>
      </div>
    </article>
  );
}
