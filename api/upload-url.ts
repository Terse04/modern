import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = process.env.VITE_APP_URL || '';
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    console.error('Supabase configuration missing');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];

  const supabaseAdmin = createClient(supabaseUrl, secretKey);

  try {
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_banned')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.is_banned) {
      return res.status(403).json({ error: 'Account is banned from uploading' });
    }

    const clientPath = (req.query.path as string) || (req.body && req.body.path);
    if (!clientPath) {
      return res.status(400).json({ error: 'Missing path parameter' });
    }

    const parts = clientPath.split('/');
    const filename = parts[parts.length - 1];
    if (filename.length > 255) {
      return res.status(400).json({ error: 'Filename too long' });
    }
    const cleanName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    const extMatch = cleanName.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : '';
    const allowedExts = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'];
    if (!allowedExts.includes(ext)) {
      return res.status(400).json({ error: 'Invalid file extension' });
    }

    const storagePath = `${user.id}/${Date.now()}_${cleanName}`;

    const { data, error } = await supabaseAdmin.storage
      .from('tracks')
      .createSignedUploadUrl(storagePath);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ...data, path: storagePath });
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
