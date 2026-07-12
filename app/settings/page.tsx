'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bot, Key, Eye, EyeOff, Check, RefreshCw, Download, AlertCircle,
  Cloud, Wifi, WifiOff, Trash2, Calendar, ChevronDown, ChevronUp,
  Database, Upload, BookOpen, Shield, FileText
} from 'lucide-react';
import { getSettings, saveSettings } from '@/lib/db/settings';
import { OllamaProvider } from '@/lib/ai/providers/ollama';
import { db } from '@/lib/db/schema';
import type { AppSettings } from '@/lib/db/schema';
import { cn } from '@/lib/utils';
import JSZip from 'jszip';
import toast from 'react-hot-toast';

const PROVIDERS = [
  {
    id: 'openai' as const,
    label: 'OpenAI',
    logo: '🤖',
    needsKey: true,
    keyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    models: [
      'o4-mini', 'o3', 'o3-mini', 'o1', 'o1-mini',
      'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
      'chatgpt-4o-latest', 'gpt-4o', 'gpt-4o-mini',
      'gpt-4-turbo', 'gpt-3.5-turbo',
    ],
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'gemini' as const,
    label: 'Google Gemini',
    logo: '✨',
    needsKey: true,
    keyPlaceholder: 'AIza...',
    docsUrl: 'https://aistudio.google.com/apikey',
    models: [
      'gemini-2.5-pro', 'gemini-2.5-flash',
      'gemini-2.0-flash', 'gemini-2.0-flash-lite',
      'gemini-1.5-pro', 'gemini-1.5-flash',
    ],
    defaultModel: 'gemini-2.5-flash',
  },
  {
    id: 'anthropic' as const,
    label: 'Anthropic Claude',
    logo: '🔷',
    needsKey: true,
    keyPlaceholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      'claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5',
      'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229', 'claude-3-haiku-20240307',
    ],
    defaultModel: 'claude-3-5-haiku-20241022',
  },
  {
    id: 'openrouter' as const,
    label: 'OpenRouter',
    logo: '🔀',
    needsKey: true,
    keyPlaceholder: 'sk-or-...',
    docsUrl: 'https://openrouter.ai/keys',
    models: [
      'openai/gpt-4o', 'openai/gpt-4o-mini', 'openai/o3-mini',
      'anthropic/claude-3.5-sonnet', 'anthropic/claude-3-haiku',
      'google/gemini-2.0-flash-001',
      'meta-llama/llama-3.3-70b-instruct',
      'meta-llama/llama-3.1-8b-instruct:free',
      'mistralai/mistral-7b-instruct:free',
      'deepseek/deepseek-r1',
    ],
    defaultModel: 'openai/gpt-4o-mini',
  },
  {
    id: 'ollama' as const,
    label: 'Ollama (Local)',
    logo: '🦙',
    needsKey: false,
    keyPlaceholder: '',
    docsUrl: 'https://ollama.com',
    models: [],
    defaultModel: 'llama3',
  },
  {
    id: 'llm7' as const,
    label: 'LLM7.io',
    logo: '⚡',
    needsKey: true,
    keyPlaceholder: 'sk-...',
    docsUrl: 'https://llm7.io',
    models: [],
    defaultModel: 'gpt-5.4-mini',
  },
];

type ProviderId = typeof PROVIDERS[number]['id'];

const KEY_FIELDS: Record<string, keyof AppSettings> = {
  openai: 'openaiKey',
  gemini: 'geminiKey',
  anthropic: 'anthropicKey',
  openrouter: 'openrouterKey',
  llm7: 'llm7Key',
};
const MODEL_FIELDS: Record<string, keyof AppSettings> = {
  openai: 'openaiModel',
  gemini: 'geminiModel',
  anthropic: 'anthropicModel',
  openrouter: 'openrouterModel',
  ollama: 'ollamaModel',
  llm7: 'llm7Model',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const [syncExpanded, setSyncExpanded] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const [checkingOllama, setCheckingOllama] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const s = await getSettings();
    setSettings(s);
    // Auto-expand active provider
    setExpandedProviders((prev) => ({ ...prev, [s.activeProvider]: true }));
    // Check Ollama in background
    checkOllama(s.ollamaBaseUrl);
  }

  async function checkOllama(baseUrl?: string) {
    setCheckingOllama(true);
    const url = baseUrl || 'http://localhost:11434';
    try {
      const res = await fetch(`${url}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        setOllamaModels(data.models.map((m: any) => m.name));
        setOllamaStatus('online');
      } else {
        setOllamaStatus('offline');
      }
    } catch {
      setOllamaStatus('offline');
    }
    setCheckingOllama(false);
  }

  async function handleExportDB() {
    try {
      const { exportDB } = await import('dexie-export-import');
      const blob = await exportDB(db, { prettyJson: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yay-schedule-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup exported successfully');
    } catch (e) {
      toast.error('Failed to export backup');
      console.error(e);
    }
  }

  async function handleImportDB(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!confirm('Warning: This will completely replace your current schedule and notes. Proceed?')) {
      e.target.value = '';
      return;
    }
    
    try {
      const { importDB } = await import('dexie-export-import');
      await db.delete(); // Delete current database to ensure clean import
      await db.open();
      await importDB(file);
      toast.success('Backup restored successfully! Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error('Failed to restore backup');
      console.error(err);
    }
    e.target.value = '';
  }

  async function setActiveProvider(id: ProviderId) {
    if (!settings) return;
    await saveSettings({ activeProvider: id });
    await loadSettings();
    toast.success(`Switched to ${PROVIDERS.find((p) => p.id === id)?.label}`);
  }

  async function saveKey(providerId: string, value: string) {
    const field = KEY_FIELDS[providerId];
    if (!field) return;
    await saveSettings({ [field]: value });
    await loadSettings();
    toast.success('API key saved');
  }

  async function saveModel(providerId: string, value: string) {
    const field = MODEL_FIELDS[providerId];
    if (!field) return;
    await saveSettings({ [field]: value });
    await loadSettings();
    toast.success('Model updated');
  }

  async function saveSyncSetting(field: 'supabaseUrl' | 'supabaseKey', value: string) {
    await saveSettings({ [field]: value });
    await loadSettings();
    toast.success('Sync settings updated');
  }

  async function handleExportZip() {
    const zip = new JSZip();
    const [notes, events, reminders, conversations] = await Promise.all([
      db.notes.toArray(), db.events.toArray(),
      db.reminders.toArray(), db.conversations.toArray(),
    ]);
    zip.file('notes.json', JSON.stringify(notes, null, 2));
    zip.file('events.json', JSON.stringify(events, null, 2));
    zip.file('reminders.json', JSON.stringify(reminders, null, 2));
    zip.file('conversations.json', JSON.stringify(conversations, null, 2));
    zip.file('readme.txt', `Personal Assistant Backup\nDate: ${new Date().toLocaleString()}\nNotes: ${notes.length} | Events: ${events.length} | Reminders: ${reminders.length}`);
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pa-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Workspace exported!');
  }

  async function handleClearAll() {
    if (!confirm('This will permanently delete ALL your data. This cannot be undone. Continue?')) return;
    await Promise.all([
      db.notes.clear(), db.events.clear(), db.reminders.clear(),
      db.conversations.clear(), db.messages.clear(), db.embeddings.clear(),
    ]);
    toast.success('All data cleared');
  }

  if (!settings) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex gap-1.5"><span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" /></div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-4 py-3 border-b border-border" style={{ background: 'hsl(var(--card) / 0.5)' }}>
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

          {/* Active Provider Banner */}
          <div className="glass rounded-2xl p-4" style={{ border: '1px solid hsl(var(--primary) / 0.2)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)' }}>
                {PROVIDERS.find((p) => p.id === settings.activeProvider)?.logo}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Currently Active</p>
                <p className="text-sm font-bold text-foreground">
                  {PROVIDERS.find((p) => p.id === settings.activeProvider)?.label}
                  {' · '}
                  <span className="text-primary font-mono text-xs">
                    {settings[MODEL_FIELDS[settings.activeProvider]] as string}
                  </span>
                </p>
              </div>
              <div className="ml-auto">
                {settings.activeProvider === 'ollama' ? (
                  ollamaStatus === 'online'
                    ? <span className="flex items-center gap-1 text-xs" style={{ color: '#4ade80' }}><Wifi size={12} />Online</span>
                    : <span className="flex items-center gap-1 text-xs" style={{ color: '#f87171' }}><WifiOff size={12} />Offline</span>
                ) : (
                  <span className="flex items-center gap-1 text-xs" style={{ color: '#60a5fa' }}><Cloud size={12} />Cloud</span>
                )}
              </div>
            </div>
          </div>

          {/* AI Providers */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Bot size={15} className="text-primary" />
              AI Providers
            </h2>
            <div className="space-y-2">
              {PROVIDERS.map((provider) => {
                const isActive = settings.activeProvider === provider.id;
                const keyField = KEY_FIELDS[provider.id];
                const modelField = MODEL_FIELDS[provider.id];
                const currentKey = keyField ? (settings[keyField] as string | undefined) : undefined;
                const currentModel = (settings[modelField] as string) || provider.defaultModel;
                const isExpanded = expandedProviders[provider.id] ?? false;

                return (
                  <div
                    key={provider.id}
                    className="bg-card rounded-2xl overflow-hidden transition-all"
                    style={{ border: isActive ? '1px solid hsl(var(--primary) / 0.5)' : '1px solid hsl(var(--border))' }}
                  >
                    {/* Provider header — always clickable */}
                    <button
                      type="button"
                      onClick={() => setExpandedProviders((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary transition-all"
                    >
                      <span className="text-xl">{provider.logo}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{provider.label}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {provider.id === 'ollama'
                            ? (ollamaStatus === 'online' ? `${ollamaModels.length} model(s) found` : 'Run Ollama on your laptop')
                            : currentKey ? `Key saved · ${currentModel}` : 'No API key configured'
                          }
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isActive && (
                          <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg"
                            style={{ background: 'hsl(var(--primary) / 0.2)', color: 'hsl(var(--primary))' }}>
                            <Check size={10} />Active
                          </span>
                        )}
                        {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Expanded body */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                        {/* API Key */}
                        {provider.needsKey && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1.5 flex items-center justify-between">
                              <span className="flex items-center gap-1.5"><Key size={11} />API Key</span>
                              <a href={provider.docsUrl} target="_blank" rel="noreferrer"
                                className="text-primary hover:underline">Get key →</a>
                            </label>
                            <div className="relative">
                              <input
                                type={showKeys[provider.id] ? 'text' : 'password'}
                                defaultValue={currentKey || ''}
                                placeholder={provider.keyPlaceholder || `Enter your ${provider.label} API key...`}
                                onBlur={(e) => {
                                  if (e.target.value !== currentKey) {
                                    saveKey(provider.id, e.target.value);
                                  }
                                }}
                                className="input-base w-full pr-10 text-xs font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => setShowKeys((p) => ({ ...p, [provider.id]: !p[provider.id] }))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                {showKeys[provider.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                            </div>
                            {currentKey && (
                              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#4ade80' }}>
                                <Check size={10} />Key saved · stored only on your device
                              </p>
                            )}
                          </div>
                        )}

                        {/* Ollama URL */}
                        {provider.id === 'ollama' && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1.5 block">Ollama Base URL</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                defaultValue={settings.ollamaBaseUrl}
                                onBlur={(e) => saveSettings({ ollamaBaseUrl: e.target.value })}
                                className="input-base flex-1 text-xs font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => checkOllama(settings.ollamaBaseUrl)}
                                disabled={checkingOllama}
                                className="btn-ghost border border-border px-3 flex items-center gap-1.5 text-xs"
                              >
                                <RefreshCw size={12} className={checkingOllama ? 'animate-spin' : ''} />
                                Refresh
                              </button>
                            </div>
                            {ollamaStatus === 'offline' && (
                              <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#fbbf24' }}>
                                <AlertCircle size={11} />Ollama not detected. Start Ollama on your laptop first.
                              </p>
                            )}
                            {ollamaStatus === 'online' && ollamaModels.length === 0 && (
                              <p className="text-xs mt-1.5 text-muted-foreground">
                                Ollama running but no models found. Run: <code className="text-primary">ollama pull llama3</code>
                              </p>
                            )}
                          </div>
                        )}

                        {/* Model selector */}
                        <div>
                          <label className="text-xs text-muted-foreground mb-1.5 block">Model</label>
                          {provider.id === 'ollama' ? (
                            ollamaModels.length > 0 ? (
                              <select
                                value={currentModel}
                                onChange={(e) => saveModel(provider.id, e.target.value)}
                                className="input-base w-full text-xs"
                              >
                                {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
                              </select>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {ollamaStatus === 'online'
                                  ? 'No models found. Pull a model with Ollama.'
                                  : 'Ollama not running.'}
                              </p>
                            )
                          ) : (
                            <select
                              value={currentModel}
                              onChange={(e) => saveModel(provider.id, e.target.value)}
                              className="input-base w-full text-xs"
                            >
                              {provider.models.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          )}
                        </div>

                        {/* Set as active */}
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => setActiveProvider(provider.id)}
                            className="w-full btn-primary text-xs py-2.5 flex items-center justify-center gap-1.5"
                          >
                            Use {provider.label} as Active Provider
                          </button>
                        )}
                        {isActive && (
                          <div className="text-xs text-center text-muted-foreground py-1">
                            ✅ This provider is currently active
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Google Calendar placeholder */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Calendar size={15} style={{ color: '#60a5fa' }} />
              Google Calendar
              <span className="text-xs text-muted-foreground font-normal">(Coming soon)</span>
            </h2>
            <div className="bg-card border border-border rounded-2xl p-4" style={{ opacity: 0.7 }}>
              <p className="text-xs text-muted-foreground">
                Two-way Google Calendar sync will be added in a future update. All your events are stored locally and fully accessible right now.
              </p>
            </div>
          </div>

          {/* Data Management */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Download size={15} style={{ color: '#4ade80' }} />
              Data Management
            </h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Export Workspace</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Download all your data as a ZIP backup</p>
                </div>
                <button onClick={handleExportZip} className="btn-primary text-xs flex items-center gap-1.5">
                  <Download size={12} />Export ZIP
                </button>
              </div>
              <div className="border-t border-border p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-destructive">Clear All Data</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Permanently delete everything</p>
                </div>
                <button onClick={handleClearAll}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: 'hsl(var(--destructive) / 0.2)', color: 'hsl(var(--destructive))' }}>
                  <Trash2 size={12} />Clear
                </button>
              </div>
            </div>
            <div 
              className="bg-card border border-border rounded-2xl overflow-hidden mt-3 transition-all"
              style={{ border: (settings?.supabaseUrl && settings?.supabaseKey) ? '1px solid hsl(var(--primary) / 0.5)' : '1px solid hsl(var(--border))' }}
            >
              <button
                type="button"
                onClick={() => setSyncExpanded(!syncExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-secondary transition-all text-left"
              >
                <div>
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Cloud size={14} className={(settings?.supabaseUrl && settings?.supabaseKey) ? "text-primary" : "text-muted-foreground"} />
                    Cloud Sync (Supabase)
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(settings?.supabaseUrl && settings?.supabaseKey) ? 'Configured & Active' : 'Bring Your Own Database (Optional)'}
                  </p>
                </div>
                {syncExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              </button>

              {syncExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground">
                    To sync across devices safely, create a free project at supabase.com, run the setup SQL, and paste your keys here. 
                    Your data will sync automatically in the background.
                  </p>
                  
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Project URL</label>
                    <input
                      type="url"
                      defaultValue={settings?.supabaseUrl || ''}
                      placeholder="https://your-project.supabase.co"
                      onBlur={(e) => saveSyncSetting('supabaseUrl', e.target.value.trim())}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Anon Public API Key</label>
                    <input
                      type="password"
                      defaultValue={settings?.supabaseKey || ''}
                      placeholder="eyJhb..."
                      onBlur={(e) => saveSyncSetting('supabaseKey', e.target.value.trim())}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="pt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={async () => {
                          const { forcePushSync } = await import('@/lib/db/sync');
                          const toast = (await import('react-hot-toast')).default;
                          toast.loading('Pushing to cloud...', { id: 'sync' });
                          const success = await forcePushSync();
                          if (success) {
                            toast.success('Pushed successfully!', { id: 'sync' });
                          } else {
                            toast.error('Failed to push', { id: 'sync' });
                          }
                        }} 
                        disabled={!(settings?.supabaseUrl && settings?.supabaseKey)}
                        className="btn-primary text-xs flex justify-center items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Upload size={12} /> Push to Cloud
                      </button>

                      <button 
                        onClick={async () => {
                          if (!confirm('Warning: This will completely replace your local schedule, notes, and chats with the cloud version. Proceed?')) return;
                          const { pullSyncOverwrite } = await import('@/lib/db/sync');
                          const toast = (await import('react-hot-toast')).default;
                          toast.loading('Pulling from cloud...', { id: 'sync' });
                          const success = await pullSyncOverwrite();
                          if (success) {
                            toast.success('Pulled successfully! Reloading...', { id: 'sync' });
                            setTimeout(() => window.location.reload(), 1500);
                          } else {
                            toast.error('Failed to pull or no cloud data', { id: 'sync' });
                          }
                        }} 
                        disabled={!(settings?.supabaseUrl && settings?.supabaseKey)}
                        className="btn-primary text-xs flex justify-center items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Download size={12} /> Pull from Cloud
                      </button>
                    </div>

                    <button 
                      onClick={() => {
                        if (!settings?.supabaseUrl || !settings?.supabaseKey) {
                           import('react-hot-toast').then(m => m.default.error('Please save your Supabase keys first!'));
                           return;
                        }
                        const url = `${window.location.origin}/api/calendar/feed?url=${encodeURIComponent(settings.supabaseUrl || '')}&key=${encodeURIComponent(settings.supabaseKey || '')}`;
                        navigator.clipboard.writeText(url);
                        import('react-hot-toast').then(m => m.default.success('Calendar URL copied! Paste this into Google Calendar.'));
                      }} 
                      className="btn-primary w-full text-xs flex justify-center items-center gap-1.5 text-white border-0"
                    >
                      <Calendar size={12} /> Get Calendar Feed Link (.ics)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Week Start Setting */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Calendar size={15} style={{ color: '#0ea5e9' }} />
              Calendar Preferences
            </h2>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Week Starts On</p>
                  <p className="text-xs text-muted-foreground mt-0.5">First day of the week in your calendar</p>
                </div>
                <select
                  value={settings.weekStartsOn ?? 1}
                  onChange={async (e) => {
                    const val = parseInt(e.target.value) as 0 | 1;
                    await saveSettings({ weekStartsOn: val });
                    await loadSettings();
                    toast.success(val === 1 ? 'Week starts on Monday' : 'Week starts on Sunday');
                  }}
                  className="input-base text-xs"
                  style={{ width: 'auto', padding: '0.4rem 0.75rem' }}
                >
                  <option value={1}>Monday</option>
                  <option value={0}>Sunday</option>
                </select>
              </div>
            </div>
          </div>

          {/* Data Management */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Database size={15} style={{ color: '#0ea5e9' }} />
              Data Management
            </h2>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-sm font-medium text-foreground">Local Backup & Restore</p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                Your data is stored locally on this device. If you use multiple devices, connecting to Supabase will sync them. Otherwise, you can manually backup your local data here.
              </p>
              <div className="flex gap-2">
                <button onClick={handleExportDB} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3">
                  <Download size={13} /> Export Backup
                </button>
                <label className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 cursor-pointer hover:bg-secondary/80 transition-colors rounded-xl border border-border bg-secondary text-foreground">
                  <Upload size={13} /> Restore Backup
                  <input type="file" accept=".json" className="hidden" onChange={handleImportDB} />
                </label>
              </div>
            </div>
          </div>

          {/* Privacy */}
          <div className="glass rounded-2xl p-4 border border-border">
            <p className="text-xs text-muted-foreground leading-relaxed">
              🔒 <strong className="text-foreground">Privacy first.</strong> All your data lives in your browser's IndexedDB, never on any server. API keys are stored only on your device. Each person who visits this app on their own device gets a completely separate, empty workspace.
            </p>
          </div>

          {/* About */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-4">
              <h2 className="text-sm font-semibold text-foreground mb-4">About</h2>
              <div className="flex items-center gap-4">
                <img
                  src="/mahesh.jpg"
                  alt="Mahesh Arora"
                  className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
                  style={{ border: '2px solid hsl(var(--border))' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Mahesh Arora</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Built Yay Schedule as a personal productivity tool for managing timetables, notes, and reminders.</p>
                  <div className="flex items-center gap-3 mt-3">
                    <a
                      href="https://www.linkedin.com/in/mahesh-arora-385662204/"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                      style={{ background: 'hsl(var(--secondary))', color: '#0ea5e9' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      LinkedIn
                    </a>
                    <a
                      href="https://www.instagram.com/macky_ar"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                      style={{ background: 'hsl(var(--secondary))', color: '#e1306c' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                      Instagram
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Documentation & Legal */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-4">
              <h2 className="text-sm font-semibold text-foreground mb-4">Documentation & Legal</h2>
              <div className="space-y-3">
                <Link href="/manual" className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors">
                  <BookOpen size={16} className="text-muted-foreground" /> User Manual
                </Link>
                <Link href="/privacy" className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors">
                  <Shield size={16} className="text-muted-foreground" /> Privacy Policy
                </Link>
                <Link href="/terms" className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors">
                  <FileText size={16} className="text-muted-foreground" /> Terms & Conditions
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
