import { db } from './schema';
import { getSupabaseClient } from '../supabase';

export interface SyncPayload {
  notes: any[];
  events: any[];
  reminders: any[];
  conversations: any[];
  messages: any[];
  settings: any[];
}

export async function exportDb(): Promise<SyncPayload> {
  const [notes, events, reminders, conversations, messages, settings] = await Promise.all([
    db.notes.toArray(),
    db.events.toArray(),
    db.reminders.toArray(),
    db.conversations.toArray(),
    db.messages.toArray(),
    db.settings.toArray(),
  ]);

  return { notes, events, reminders, conversations, messages, settings };
}

export async function mergeDb(remoteData: SyncPayload): Promise<void> {
  const mergeTable = async (tableName: any, remoteItems: any[]) => {
    const table = (db as any)[tableName];
    if (!table || !remoteItems || !Array.isArray(remoteItems)) return;

    const localItems = await table.toArray();
    const localMap = new Map(localItems.map((item: any) => [item.id, item]));

    const toPut: any[] = [];
    
    for (const remote of remoteItems) {
      const local = localMap.get(remote.id) as any;
      if (!local) {
        // Missing locally, insert it
        toPut.push(remote);
      } else {
        // Exists locally, check timestamp
        const remoteTime = remote.updatedAt || remote.createdAt || 0;
        const localTime = local.updatedAt || local.createdAt || 0;
        if (remoteTime > localTime) {
          toPut.push(remote);
        }
      }
    }

    if (toPut.length > 0) {
      await table.bulkPut(toPut);
    }
  };

  await Promise.all([
    mergeTable('notes', remoteData.notes),
    mergeTable('events', remoteData.events),
    mergeTable('reminders', remoteData.reminders),
    mergeTable('conversations', remoteData.conversations),
    mergeTable('messages', remoteData.messages),
    mergeTable('settings', remoteData.settings),
  ]);
}

let syncTimeout: NodeJS.Timeout | null = null;
let isSyncing = false;

export async function forcePushSync() {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return false;

    const payload = await exportDb();
    await supabase.from('sync_state').upsert({
      id: 'user_1',
      data: payload,
      updated_at: new Date().toISOString()
    });
    localStorage.setItem('last_sync_push', new Date().toISOString());
    localStorage.setItem('last_sync_pull', new Date().toISOString()); // Mark synced
    return true;
  } catch (err) {
    console.error('Push sync failed:', err);
    return false;
  }
}

export function pushSync() {
  // Prevent empty/new devices from automatically overwriting Supabase data.
  // We only allow automatic background push if we have pulled at least once.
  if (typeof window !== 'undefined' && !localStorage.getItem('last_sync_pull')) {
    console.log('Skipping automatic push sync: last_sync_pull is not set');
    return;
  }

  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    forcePushSync();
  }, 2000); // 2 second debounce
}

export async function pullSync(): Promise<boolean> {
  if (isSyncing) return false;
  isSyncing = true;
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      isSyncing = false;
      return false; // Sync not configured
    }

    const { data, error } = await supabase
      .from('sync_state')
      .select('data, updated_at')
      .eq('id', 'user_1');

    if (error) {
      console.error('Pull sync fetch error:', error);
      isSyncing = false;
      return false;
    }

    if (!data || data.length === 0) {
      // Server has no sync state yet. Set last_sync_pull to allow subsequent pushes.
      if (typeof window !== 'undefined' && !localStorage.getItem('last_sync_pull')) {
        localStorage.setItem('last_sync_pull', new Date().toISOString());
      }
      isSyncing = false;
      return false;
    }

    const remoteRecord = data[0];
    if (!remoteRecord || !remoteRecord.data) {
      isSyncing = false;
      return false;
    }

    const lastSyncStr = localStorage.getItem('last_sync_pull');
    const remoteTime = new Date(remoteRecord.updated_at).getTime();
    const localTime = lastSyncStr ? new Date(lastSyncStr).getTime() : 0;

    // Only merge if remote is newer, or if we haven't successfully synced yet
    if (remoteTime > localTime || !lastSyncStr) {
      await mergeDb(remoteRecord.data as SyncPayload);
      localStorage.setItem('last_sync_pull', new Date().toISOString());
      isSyncing = false;
      return true; // Changes were pulled
    }
  } catch (err) {
    console.error('Pull sync failed:', err);
  }
  isSyncing = false;
  return false;
}

export async function pullSyncOverwrite(): Promise<boolean> {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return false;

    const { data, error } = await supabase
      .from('sync_state')
      .select('data')
      .eq('id', 'user_1')
      .single();

    if (error || !data || !data.data) {
      return false;
    }

    const remoteData = data.data as SyncPayload;
    const localSettings = await db.settings.get('app_settings');

    const overwriteTable = async (tableName: string, items: any[]) => {
      const table = (db as any)[tableName];
      if (!table) return;
      await table.clear();
      if (items && items.length > 0) {
        await table.bulkPut(items);
      }
    };

    await Promise.all([
      overwriteTable('notes', remoteData.notes),
      overwriteTable('events', remoteData.events),
      overwriteTable('reminders', remoteData.reminders),
      overwriteTable('conversations', remoteData.conversations),
      overwriteTable('messages', remoteData.messages),
      overwriteTable('settings', remoteData.settings),
    ]);

    if (localSettings) {
      const remoteSettings = await db.settings.get('app_settings');
      await db.settings.put({
        ...remoteSettings,
        id: 'app_settings',
        supabaseUrl: localSettings.supabaseUrl,
        supabaseKey: localSettings.supabaseKey,
        openaiKey: localSettings.openaiKey || remoteSettings?.openaiKey,
        geminiKey: localSettings.geminiKey || remoteSettings?.geminiKey,
        anthropicKey: localSettings.anthropicKey || remoteSettings?.anthropicKey,
        openrouterKey: localSettings.openrouterKey || remoteSettings?.openrouterKey,
        llm7Key: localSettings.llm7Key || remoteSettings?.llm7Key,
        updatedAt: remoteSettings?.updatedAt || localSettings.updatedAt || Date.now(),
      } as any);
    }

    localStorage.setItem('last_sync_pull', new Date().toISOString());
    return true;
  } catch (err) {
    console.error('Pull overwrite failed:', err);
    return false;
  }
}

// Setup DB hooks to trigger pushSync automatically
db.on('ready', () => {
  ['notes', 'events', 'reminders', 'conversations', 'messages', 'settings'].forEach((tableName) => {
    const table = (db as any)[tableName];
    if (table) {
      table.hook('creating', () => { pushSync(); });
      table.hook('updating', () => { pushSync(); });
      table.hook('deleting', () => { pushSync(); });
    }
  });
});
