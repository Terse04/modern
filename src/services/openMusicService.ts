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
];

// Official Audius discovery nodes
const AUDIUS_DISCOVERY_NODES = [
  'https://discoveryprovider.audius.co',
  'https://audius-discovery-1.cultur3stake.com',
  'https://audius-dp.amsterdam.creatorseed.com',
];

const APP_NAME = 'modern_listening_together';

export const openMusicService = {
  /**
   * Search open-source & royalty-free music from decentralized Audius network
   */
  async searchTracks(query: string, limit = 15): Promise<Track[]> {
    if (!query.trim()) {
      return this.getTrendingTracks('all', limit);
    }

    const trimmed = encodeURIComponent(query.trim());

    for (const node of AUDIUS_DISCOVERY_NODES) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

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
        // Fallback to next discovery node
      }
    }

    // Filter curated tracks if search fails or offline
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
   * Get trending open music tracks by genre
   */
  async getTrendingTracks(genre = 'all', limit = 15): Promise<Track[]> {
    const genreParam = genre && genre !== 'all' ? `&genre=${encodeURIComponent(genre)}` : '';

    for (const node of AUDIUS_DISCOVERY_NODES) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

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

    return CURATED_OPEN_TRACKS;
  },

  /**
   * Helper to map Audius track response to Modern Track format
   */
  mapAudiusTrackToTrack(node: string) {
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
