import { createClient } from '@supabase/supabase-js';
import { db } from './db/schema';

let cachedClient: any = null;
let lastUrl = '';
let lastKey = '';

export async function getSupabaseClient() {
  const settings = await db.settings.get('settings');
  if (!settings || !settings.supabaseUrl || !settings.supabaseKey) {
    return null;
  }

  // If the keys changed, recreate the client
  if (settings.supabaseUrl !== lastUrl || settings.supabaseKey !== lastKey) {
    cachedClient = createClient(settings.supabaseUrl, settings.supabaseKey);
    lastUrl = settings.supabaseUrl;
    lastKey = settings.supabaseKey;
  }

  return cachedClient;
}
