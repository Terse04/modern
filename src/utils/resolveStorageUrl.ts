/**
 * Resolves a Supabase storage path to a playable URL.
 *
 * The `tracks` bucket is PRIVATE, so getPublicUrl() returns 403 for
 * non-owners. This helper uses createSignedUrl() which generates a
 * time-limited URL that respects the SELECT RLS policies.
 *
 * If the value already looks like a full URL (http/https, data:, blob:),
 * it's returned as-is.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

/** Default signed-URL expiry: 1 hour */
const SIGNED_URL_EXPIRY_SECS = 3600;

/**
 * In-memory cache keyed by storage path → { signedUrl, expiresAt }.
 * Prevents redundant network calls for the same path within the TTL.
 */
const urlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Resolve a `tracks.audio_url` value into a playable URL.
 *
 * - Full URLs (http, data:, blob:) are returned as-is
 * - Storage paths are signed via createSignedUrl()
 * - Results are cached in-memory until 5 minutes before expiry
 */
export async function resolveStorageUrl(audioUrl: string): Promise<string> {
  if (!audioUrl) return '';

  // Already a usable URL
  if (
    audioUrl.startsWith('http://') ||
    audioUrl.startsWith('https://') ||
    audioUrl.startsWith('data:') ||
    audioUrl.startsWith('blob:')
  ) {
    return audioUrl;
  }

  // It's a storage path — check cache
  const cached = urlCache.get(audioUrl);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 5 * 60 * 1000) {
    return cached.url;
  }

  // Need Supabase client
  const client = supabase;
  if (!isSupabaseConfigured || !client) {
    return audioUrl; // Can't sign — return raw path as fallback
  }

  try {
    const { data, error } = await client.storage
      .from('tracks')
      .createSignedUrl(audioUrl, SIGNED_URL_EXPIRY_SECS);

    if (error || !data?.signedUrl) {
      console.warn('[resolveStorageUrl] Failed to sign:', audioUrl, error?.message);
      return audioUrl;
    }

    urlCache.set(audioUrl, {
      url: data.signedUrl,
      expiresAt: now + SIGNED_URL_EXPIRY_SECS * 1000,
    });

    return data.signedUrl;
  } catch (err) {
    console.warn('[resolveStorageUrl] Error signing URL:', err);
    return audioUrl;
  }
}

/**
 * Batch-resolve multiple storage paths. Useful when loading a track list.
 * Returns a Map of originalPath → signedUrl.
 */
export async function resolveStorageUrls(paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const toSign: string[] = [];

  for (const p of paths) {
    if (!p || p.startsWith('http') || p.startsWith('data:') || p.startsWith('blob:')) {
      result.set(p, p);
      continue;
    }
    const cached = urlCache.get(p);
    if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
      result.set(p, cached.url);
    } else {
      toSign.push(p);
    }
  }

  if (toSign.length === 0) return result;

  const client = supabase;
  if (!isSupabaseConfigured || !client) {
    toSign.forEach((p) => result.set(p, p));
    return result;
  }

  // Sign in parallel (Supabase doesn't have a batch API)
  const signResults = await Promise.allSettled(
    toSign.map((p) =>
      client.storage.from('tracks').createSignedUrl(p, SIGNED_URL_EXPIRY_SECS).then((r) => ({ path: p, ...r }))
    )
  );

  const now = Date.now();
  for (const sr of signResults) {
    if (sr.status === 'fulfilled' && sr.value.data?.signedUrl) {
      const { path } = sr.value;
      const signedUrl = sr.value.data.signedUrl;
      urlCache.set(path, { url: signedUrl, expiresAt: now + SIGNED_URL_EXPIRY_SECS * 1000 });
      result.set(path, signedUrl);
    } else if (sr.status === 'fulfilled') {
      result.set(sr.value.path, sr.value.path);
    }
  }

  return result;
}
