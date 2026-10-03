import { Track } from '../types';

// Curated high quality open-source / Creative Commons tracks for instant zero-latency loading
export const CURATED_OPEN_TRACKS: Track[] = [
  {
    id: 'open_lofi_1',
    title: 'Warm Memories (Lo-Fi Chill)',
    artist: 'Purrple Cat',
    album: 'Creative Commons Sounds',
    artwork: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    duration: 165,
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
    genre: 'Lo-Fi / Chillhop',
  },
  {
    id: 'open_ambient_2',
    title: 'Deep Cosmic Resonance',
    artist: 'Stellar Drone',
    album: 'Open Soundscapes',
    artwork: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
    duration: 198,
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3',
    genre: 'Ambient Space',
  },
  {
    id: 'open_synth_3',
    title: 'Neon Horizon (Synthwave)',
    artist: 'Retro Mind',
    album: 'Cyber Echoes',
    artwork: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80',
    duration: 182,
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f77519.mp3',
    genre: 'Synthwave',
  },
  {
    id: 'open_piano_4',
    title: 'Nocturne Reflections (Neo-Classical)',
    artist: 'Aura Bloom',
    album: 'Acoustic Journeys',
    artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
    duration: 210,
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3',
    genre: 'Acoustic / Neo-Classical',
  },
  {
    id: 'open_downtempo_5',
    title: 'Late Night Coffee',
    artist: 'Urban Pulse',
    album: 'Midnight Sessions',
    artwork: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80',
    duration: 145,
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/11/06/audio_c93a02796e.mp3',
    genre: 'Downtempo',
  },
  {
    id: 'open_lofi_6',
    title: 'Autumn Raindrops',
    artist: 'Ghostrifter Official',
    album: 'Lo-Fi Chill Sessions',
    artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
    duration: 172,
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c36398935c.mp3',
    genre: 'Lo-Fi / Chillhop',
  },
  {
    id: 'open_electronic_7',
    title: 'Cyber Pulse 2088',
    artist: 'Kovan',
    album: 'Future Horizon',
    artwork: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80',
    duration: 195,
    audioUrl: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_823a851952.mp3',
    genre: 'Electronic',
  },
  {
    id: 'open_indie_8',
    title: 'Sunlight Through Leaves',
    artist: 'Acoustic Breeze',
    album: 'Morning Walk',
    artwork: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=600&q=80',
    duration: 158,
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_24e9ec6bba.mp3',
    genre: 'Indie / Folk',
  },
];

// Jamendo API Client configuration (600,000+ tracks under Creative Commons)
const JAMENDO_CLIENT_ID = '56d30c95';

interface JamendoTrack {
  id: string;
  name: string;
  duration: number;
  artist_name: string;
  album_name: string;
  image: string;
  audio: string;
  musicinfo?: {
    tags?: {
      genres?: string[];
    };
  };
}

// Audius discovery nodes
const AUDIUS_DISCOVERY_NODES = [
  'https://discoveryprovider.audius.co',
  'https://audius-discovery-1.cultur3stake.com',
  'https://audius-dp.amsterdam.creatorseed.com',
];

const APP_NAME = 'together_listening_room';

function mapJamendoTrack(item: JamendoTrack): Track {
  return {
    id: `jamendo_${item.id}`,
    title: item.name || 'Untitled Track',
    artist: item.artist_name || 'Independent Artist',
    album: item.album_name || 'Jamendo Music',
    artwork: item.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
    duration: item.duration || 180,
    audioUrl: item.audio,
    genre: item.musicinfo?.tags?.genres?.[0] || 'Music',
  };
}

export const openMusicService = {
  /**
   * Search tracks across Jamendo (600K+ CC tracks) and Audius
   */
  async searchTracks(query: string, limit = 20): Promise<Track[]> {
    if (!query.trim()) {
      return this.getTrendingTracks('all', limit);
    }

    const trimmed = encodeURIComponent(query.trim());

    // 1. Query Jamendo first for fast, high-availability direct CDN audio streams
    try {
      const jamendoUrl = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=${limit}&namesearch=${trimmed}&include=musicinfo&audioformat=mp32`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(jamendoUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.results) && data.results.length > 0) {
          const tracks = data.results.map(mapJamendoTrack);
          return tracks;
        }
      }
    } catch {
      // Fallback to Audius
    }

    // 2. Query Audius decentralized nodes
    for (const node of AUDIUS_DISCOVERY_NODES) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const url = `${node}/v1/tracks/search?query=${trimmed}&app_name=${APP_NAME}&limit=${limit}`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data) && json.data.length > 0) {
            return json.data.map(this.mapAudiusTrackToTrack(node));
          }
        }
      } catch {
        // Try next node
      }
    }

    // 3. Fallback: filter curated local library
    const qLower = query.toLowerCase();
    const matched = CURATED_OPEN_TRACKS.filter(
      (t) =>
        t.title.toLowerCase().includes(qLower) ||
        t.artist.toLowerCase().includes(qLower) ||
        t.genre?.toLowerCase().includes(qLower)
    );
    return matched.length > 0 ? matched : CURATED_OPEN_TRACKS;
  },

  /**
   * Get trending music tracks by genre from Jamendo and Audius
   */
  async getTrendingTracks(genre = 'all', limit = 20): Promise<Track[]> {
    const genreTag = genre && genre !== 'all' ? `&tags=${encodeURIComponent(genre.toLowerCase())}` : '';

    // 1. Try Jamendo weekly popular tracks
    try {
      const jamendoUrl = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=${limit}&order=popularity_week&include=musicinfo&audioformat=mp32${genreTag}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(jamendoUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.results) && data.results.length > 0) {
          return data.results.map(mapJamendoTrack);
        }
      }
    } catch {
      // Fallback to Audius
    }

    // 2. Try Audius trending
    const genreParam = genre && genre !== 'all' ? `&genre=${encodeURIComponent(genre)}` : '';
    for (const node of AUDIUS_DISCOVERY_NODES) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const url = `${node}/v1/tracks/trending?app_name=${APP_NAME}&limit=${limit}${genreParam}`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data) && json.data.length > 0) {
            return json.data.map(this.mapAudiusTrackToTrack(node));
          }
        }
      } catch {
        // Try next node
      }
    }

    // 3. Fallback to curated tracks
    if (genre && genre !== 'all') {
      const filtered = CURATED_OPEN_TRACKS.filter(t => t.genre?.toLowerCase().includes(genre.toLowerCase()));
      if (filtered.length > 0) return filtered;
    }

    return CURATED_OPEN_TRACKS;
  },

  /**
   * Helper to map Audius track response to Track format
   */
  mapAudiusTrackToTrack(node: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (item: any): Track => {
      const artwork =
        item.artwork?.['480x480'] ||
        item.artwork?.['150x150'] ||
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80';

      return {
        id: `audius_${item.id}`,
        title: item.title || 'Untitled Track',
        artist: item.user?.name || item.user?.handle || 'Independent Artist',
        album: item.genre || 'Open Library',
        artwork,
        duration: item.duration || 180,
        audioUrl: `${node}/v1/tracks/${item.id}/stream?app_name=${APP_NAME}`,
        genre: item.genre || 'Electronic',
      };
    };
  },
};
