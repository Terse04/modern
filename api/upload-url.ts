import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://lvudbyfktpymccdskmtf.supabase.co';

const secretKey =
  process.env.SUPABASE_SECRET_KEY ||
  'sb_secret_Kk163O-7QqYrY--UgibG6A_o286NMKx';

const supabaseAdmin = createClient(supabaseUrl, secretKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const path = (req.query.path as string) || (req.body && req.body.path);
  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  try {
    const { data, error } = await supabaseAdmin.storage
      .from('tracks')
      .createSignedUploadUrl(path);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
