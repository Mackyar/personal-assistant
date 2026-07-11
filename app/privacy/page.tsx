'use client';

import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-card/50 sticky top-0 z-10">
        <Link href="/settings" className="p-2 -ml-2 rounded-xl hover:bg-secondary text-muted-foreground transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Shield size={18} className="text-primary" />
          Privacy Policy
        </h1>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-8 pb-20">
        <section>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong>Last Updated:</strong> July 11, 2026
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">1. Local-First Architecture</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Yay Schedule is built with a "local-first" architecture. By default, all data you create—including calendar events, notes, chat histories, and API keys—is stored entirely on your device within your browser's IndexedDB. We do not operate any centralized servers to store your personal data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">2. API Keys and Third-Party Services</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            If you choose to integrate third-party AI services (e.g., OpenAI, Anthropic, Gemini, or LLM7), your API keys are saved only on your local device. When you send a message, your chat data is sent directly to the respective third-party provider's API. We do not intercept, monitor, or store these requests. Please refer to the privacy policies of the specific AI providers you choose to use.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">3. Cloud Sync via Supabase</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Yay Schedule offers an optional cloud sync feature using Supabase. If you enable this feature, you must provide your own Supabase project credentials. Your data will be transmitted to and stored on your personal Supabase database. We do not have access to your Supabase project, your credentials, or the data stored within it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">4. Analytics and Tracking</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            We respect your privacy. Yay Schedule does not include any third-party trackers, analytics scripts, or advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">5. Changes to this Policy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Because this application runs entirely in your browser and we do not collect your data, our privacy practices are largely static. However, if we introduce new features that require data transmission, we will update this policy accordingly.
          </p>
        </section>
      </div>
    </div>
  );
}
