import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { Track } from '../types';
import { extractAudioMetadata } from '../utils/audioMetadata';

// In-memory / session cache for uploaded custom audio URLs
const LOCAL_TRACKS_KEY = 'together_custom_tracks';

// Simple lightweight IndexedDB store for local audio blobs so they persist across refreshes
const DB_NAME = 'TogetherAudioDB';
const STORE_NAME = 'audio_blobs';

function openAudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeBlobLocally(id: string, blob: Blob): Promise<void> {
  try {
    const db = await openAudioDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id, blob, createdAt: Date.now() });
  } catch (err) {
    console.warn('[StorageService] IndexedDB save failed:', err);
  }
}

export async function getLocalBlobUrl(id: string): Promise<string | null> {
  try {
    const db = await openAudioDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve(URL.createObjectURL(req.result.blob));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export interface UploadTrackOptions {
  file: File;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  customArtworkUrl?: string;
  artworkFile?: File;
  onProgress?: (progressPercent: number) => void;
}

export const storageService = {
  /**
   * Upload audio file to Supabase Storage or IndexedDB fallback
   */
  async uploadTrack(options: UploadTrackOptions): Promise<Track> {
    const { file, artworkFile, onProgress } = options;

    onProgress?.(15);
    // 1. Extract audio metadata & peaks
    const meta = await extractAudioMetadata(file);
    onProgress?.(40);

    const title = options.title?.trim() || meta.title;
    const artist = options.artist?.trim() || meta.artist;
    const genre = options.genre || 'Electronic / Ambient';
    const album = options.album?.trim() || 'Community Uploads';

    const trackId = `trk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let audioUrl = '';
    let artworkUrl = options.customArtworkUrl || '';

    // 2. Try Supabase Storage upload
    if (isSupabaseConfigured && supabase) {
      try {
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `uploads/${Date.now()}_${cleanName}`;

        onProgress?.(60);
        // Upload audio file
        const { error: uploadErr } = await supabase.storage
          .from('tracks')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: true,
          });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('tracks').getPublicUrl(storagePath);
          audioUrl = urlData.publicUrl;
        }

        // Upload custom artwork if provided
        if (artworkFile) {
          const artExt = artworkFile.name.split('.').pop() || 'jpg';
          const artPath = `artwork/${Date.now()}_art.${artExt}`;
          const { error: artErr } = await supabase.storage.from('tracks').upload(artPath, artworkFile, {
            cacheControl: '3600',
            upsert: true,
          });
          if (!artErr) {
            const { data: artUrlData } = supabase.storage.from('tracks').getPublicUrl(artPath);
            artworkUrl = artUrlData.publicUrl;
          }
        }
      } catch (e) {
        console.warn('[StorageService] Supabase upload failed, falling back to local object URL:', e);
      }
    }

    onProgress?.(80);

    // 3. Fallback to Local Object URL + IndexedDB if no Supabase URL was generated
    if (!audioUrl) {
      audioUrl = URL.createObjectURL(file);
      await storeBlobLocally(trackId, file);
    }

    // Fallback artwork if none provided: curated Unsplash cover
    if (!artworkUrl) {
      const covers = [
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
      ];
      const hash = title.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      artworkUrl = covers[hash % covers.length];
    }

    const newTrack: Track = {
      id: trackId,
      title,
      artist,
      album,
      artwork: artworkUrl,
      duration: meta.duration,
      audioUrl,
      genre,
    };

    // 4. Save to Supabase DB if available
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('tracks').insert({
          id: newTrack.id,
          title: newTrack.title,
          artist: newTrack.artist,
          album: newTrack.album,
          artwork: newTrack.artwork,
          duration: newTrack.duration,
          audio_url: newTrack.audioUrl,
          genre: newTrack.genre,
        });
      } catch (err) {
        console.warn('[StorageService] Could not insert track into Supabase table:', err);
      }
    }

    // 5. Store in local storage for session persistence
    try {
      const existingStr = localStorage.getItem(LOCAL_TRACKS_KEY);
      const existing: Track[] = existingStr ? JSON.parse(existingStr) : [];
      localStorage.setItem(LOCAL_TRACKS_KEY, JSON.stringify([newTrack, ...existing]));
    } catch (_) {}

    onProgress?.(100);
    return newTrack;
  },

  /**
   * Get all custom-uploaded tracks
   */
  getUploadedTracks(): Track[] {
    try {
      const existingStr = localStorage.getItem(LOCAL_TRACKS_KEY);
      return existingStr ? JSON.parse(existingStr) : [];
    } catch {
      return [];
    }
  },
};
