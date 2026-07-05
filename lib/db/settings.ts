import { db, type AppSettings, DEFAULT_SETTINGS } from './schema';

// Simple XOR-based obfuscation for API keys in IndexedDB
// (IndexedDB is already sandboxed per-origin; this adds a layer of obscurity)
function obfuscate(str: string): string {
  return btoa(str.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (42 + i % 7))).join(''));
}

function deobfuscate(str: string): string {
  try {
    const decoded = atob(str);
    return decoded.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (42 + i % 7))).join('');
  } catch {
    return str;
  }
}

export async function getSettings(): Promise<AppSettings> {
  const s = await db.settings.get('settings');
  if (!s) {
    await db.settings.add(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  // Deobfuscate keys for use
  return {
    ...s,
    openaiKey: s.openaiKey ? deobfuscate(s.openaiKey) : undefined,
    geminiKey: s.geminiKey ? deobfuscate(s.geminiKey) : undefined,
    anthropicKey: s.anthropicKey ? deobfuscate(s.anthropicKey) : undefined,
    openrouterKey: s.openrouterKey ? deobfuscate(s.openrouterKey) : undefined,
  };
}

export async function saveSettings(data: Partial<AppSettings>): Promise<void> {
  const toSave: Partial<AppSettings> = { ...data, updatedAt: Date.now() };
  // Obfuscate keys before storing
  if (data.openaiKey !== undefined) toSave.openaiKey = data.openaiKey ? obfuscate(data.openaiKey) : undefined;
  if (data.geminiKey !== undefined) toSave.geminiKey = data.geminiKey ? obfuscate(data.geminiKey) : undefined;
  if (data.anthropicKey !== undefined) toSave.anthropicKey = data.anthropicKey ? obfuscate(data.anthropicKey) : undefined;
  if (data.openrouterKey !== undefined) toSave.openrouterKey = data.openrouterKey ? obfuscate(data.openrouterKey) : undefined;

  const existing = await db.settings.get('settings');
  if (existing) {
    await db.settings.update('settings', toSave);
  } else {
    await db.settings.add({ ...DEFAULT_SETTINGS, ...toSave, id: 'settings' });
  }
}
