'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen, Database, Lock, Calendar, MessageSquare, Zap } from 'lucide-react';

export default function UserManualPage() {
  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-card/50 sticky top-0 z-10">
        <Link href="/settings" className="p-2 -ml-2 rounded-xl hover:bg-secondary text-muted-foreground transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen size={18} className="text-primary" />
          User Manual
        </h1>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-8 pb-20">
        <section>
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <Zap size={18} className="text-amber-500" /> Getting Started
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Welcome to Yay Schedule! This application is designed to be your local-first, privacy-respecting second brain. 
            All of your data lives on your device by default, meaning no one else has access to it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <Lock size={18} className="text-emerald-500" /> AI Integrations & Privacy
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Yay Schedule acts as an interface to your favorite AI models without storing your API keys on external servers.
            When you enter an API key for OpenAI, Gemini, Anthropic, or LLM7, it is saved directly into your browser's local storage.
          </p>
          <div className="bg-secondary/50 rounded-xl p-4 mt-2">
            <h3 className="font-medium text-sm mb-2">Ideal Setup: Ollama (100% Offline AI)</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you value maximum privacy, we highly recommend integrating with <strong>Ollama</strong>. By running Ollama locally on your machine, your chat queries never leave your device. 
              <br/><br/>
              <strong>Setup:</strong> Go to Settings → AI Providers → Ollama. Ensure Ollama is running on your machine (usually at <code>http://localhost:11434</code>). You don't need any API keys, and it works completely offline.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <Calendar size={18} className="text-sky-500" /> Managing Your Schedule
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            The Calendar lets you plan your days easily. On mobile, you can switch between Month, Week, and Day views.
          </p>
          <div className="bg-secondary/50 rounded-xl p-4 mt-2">
            <h3 className="font-medium text-sm mb-2">Importing CSV Files</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You can import events in bulk using a CSV file. Go to the Calendar page and click the <strong>Import</strong> button. 
              Ensure your CSV has columns for <code>Date</code>, <code>Start Time</code>, <code>End Time</code>, <code>Event</code>, and optionally <code>Location</code>. 
              Double-check your date formats (e.g., DD/MM/YYYY vs MM/DD/YYYY) to ensure events land on the correct day.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <Database size={18} className="text-indigo-500" /> Syncing with Supabase (Multi-Device)
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            If you only use one device, you don't need to do anything—your data is safely stored locally. However, if you want to sync your schedule across your phone and laptop, you can connect your own Supabase database.
          </p>
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mt-2 mb-4">
            <h3 className="font-medium text-sm text-destructive mb-2">Privacy Warning for Supabase</h3>
            <p className="text-sm text-destructive/90 leading-relaxed">
              By connecting a Supabase database, your notes, events, and chats will be uploaded to that cloud database. Only you will have access to it (since you own the Supabase project), but your data will no longer be strictly offline.
            </p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-4">
            <h3 className="font-medium text-sm mb-2">Supabase Setup Instructions:</h3>
            <ol className="list-decimal pl-4 text-sm text-muted-foreground space-y-2">
              <li>Create a free account at <strong>supabase.com</strong> and create a new project.</li>
              <li>Go to Project Settings → API to find your <strong>Project URL</strong> and <strong>anon public key</strong>.</li>
              <li>In Yay Schedule, go to Settings → Cloud Sync and paste these credentials.</li>
              <li>The app will automatically initialize the necessary tables in your database.</li>
              <li>Enter the exact same URL and Key on your other devices, and click <strong>Force Sync Now</strong> to merge your data!</li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}
