import type { AnalyzedArtist, AnalyzeLineupResponse, Recommendation } from './types';
import { searchUrl } from './artistUtils';

function youtubeRecommendations(artistName: string): Recommendation[] {
  return [
    {
      provider: 'youtube',
      title: `${artistName} DJ set`,
      url: searchUrl('youtube', `${artistName} DJ set`),
      thumbnailUrl: null,
      channelTitle: 'YouTube Search'
    },
    {
      provider: 'youtube',
      title: `${artistName} Boiler Room / live set`,
      url: searchUrl('youtube', `${artistName} Boiler Room live set`),
      thumbnailUrl: null,
      channelTitle: 'YouTube Search'
    }
  ];
}

export const demoArtists: AnalyzedArtist[] = [
  {
    name: 'Peggy Gou',
    confidence: 0.98,
    stage: 'Main Stage',
    time: '22:00',
    profile: {
      description: 'Korean electronic artist known for bright, stylish house and club-focused tracks.',
      genres: ['House', 'Tech House', 'Electronic'],
      imageUrl: null,
      externalLinks: {
        youtubeSearch: searchUrl('youtube', 'Peggy Gou'),
        soundcloudSearch: searchUrl('soundcloud', 'Peggy Gou'),
        spotifySearch: searchUrl('spotify', 'Peggy Gou')
      }
    },
    recommendations: youtubeRecommendations('Peggy Gou')
  },
  {
    name: 'Fred again..',
    confidence: 0.95,
    stage: 'Live Stage',
    time: '23:30',
    profile: {
      description: 'UK producer and live electronic act blending emotional samples, house, pop, and rave energy.',
      genres: ['Electronic', 'House', 'UK Garage'],
      imageUrl: null,
      externalLinks: {
        youtubeSearch: searchUrl('youtube', 'Fred again'),
        soundcloudSearch: searchUrl('soundcloud', 'Fred again'),
        spotifySearch: searchUrl('spotify', 'Fred again')
      }
    },
    recommendations: youtubeRecommendations('Fred again..')
  },
  {
    name: 'Charlotte de Witte',
    confidence: 0.96,
    stage: 'Warehouse',
    time: '01:00',
    profile: {
      description: 'Belgian DJ and producer associated with driving peak-time techno and dark club sets.',
      genres: ['Techno', 'Acid Techno', 'Peak Time'],
      imageUrl: null,
      externalLinks: {
        youtubeSearch: searchUrl('youtube', 'Charlotte de Witte'),
        soundcloudSearch: searchUrl('soundcloud', 'Charlotte de Witte'),
        spotifySearch: searchUrl('spotify', 'Charlotte de Witte')
      }
    },
    recommendations: youtubeRecommendations('Charlotte de Witte')
  },
  {
    name: 'Four Tet',
    confidence: 0.92,
    stage: 'Garden',
    time: '20:30',
    profile: {
      description: 'UK electronic musician/DJ known for genre-blending sets across house, garage, ambient, and experimental sounds.',
      genres: ['Electronic', 'House', 'Experimental'],
      imageUrl: null,
      externalLinks: {
        youtubeSearch: searchUrl('youtube', 'Four Tet'),
        soundcloudSearch: searchUrl('soundcloud', 'Four Tet'),
        spotifySearch: searchUrl('spotify', 'Four Tet')
      }
    },
    recommendations: youtubeRecommendations('Four Tet')
  },
  {
    name: 'Joris Voorn',
    confidence: 0.93,
    stage: 'Sunset Stage',
    time: '19:00',
    profile: {
      description: 'Dutch DJ/producer known for melodic house, techno, and polished festival-friendly sets.',
      genres: ['Melodic House', 'Techno', 'Progressive House'],
      imageUrl: null,
      externalLinks: {
        youtubeSearch: searchUrl('youtube', 'Joris Voorn'),
        soundcloudSearch: searchUrl('soundcloud', 'Joris Voorn'),
        spotifySearch: searchUrl('spotify', 'Joris Voorn')
      }
    },
    recommendations: youtubeRecommendations('Joris Voorn')
  }
];

export function getDemoAnalyzeResponse(warnings: string[] = []): AnalyzeLineupResponse {
  return {
    festivalName: 'Demo Festival',
    artists: demoArtists,
    warnings: [
      'Demo/mock mode is active. Real screenshot OCR is not connected yet.',
      ...warnings
    ]
  };
}
