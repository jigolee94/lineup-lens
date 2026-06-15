export type RecommendationProvider = 'youtube';

export type ExternalLinks = {
  youtubeSearch: string;
  soundcloudSearch: string;
  spotifySearch: string;
};

export type ArtistProfile = {
  description: string | null;
  genres: string[];
  imageUrl: string | null;
  externalLinks: ExternalLinks;
};

export type Recommendation = {
  provider: RecommendationProvider;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
};

export type AnalyzedArtist = {
  name: string;
  confidence: number;
  stage: string | null;
  time: string | null;
  profile: ArtistProfile;
  recommendations: Recommendation[];
};

export type AnalyzeLineupResponse = {
  festivalName: string | null;
  artists: AnalyzedArtist[];
  warnings: string[];
};

export type ExtractedArtist = {
  name: string;
  confidence: number;
  rawTextMatch?: string;
  stage?: string | null;
  time?: string | null;
};
