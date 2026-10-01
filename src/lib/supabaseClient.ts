import { createClient } from '@supabase/supabase-js';

function isValidUrl(url: unknown): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://')) return false;
  if (trimmed.includes('your-project') || trimmed.includes('aBcDe.supabase.co')) return false;
  return true;
}

const candidateUrls: (string | undefined)[] = [
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL,
];

const candidateKeys: (string | undefined)[] = [
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
];

const supabaseUrl = (candidateUrls.find(isValidUrl) || '').trim();
const supabaseAnonKey = (
  candidateKeys.find(
    (k) => typeof k === 'string' && k.trim().length > 20 && !k.includes('your-anon-key')
  ) || ''
).trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;


