'use client';

import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-card/50 sticky top-0 z-10">
        <Link href="/settings" className="p-2 -ml-2 rounded-xl hover:bg-secondary text-muted-foreground transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          Terms & Conditions
        </h1>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-8 pb-20">
        <section>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong>Last Updated:</strong> July 11, 2026
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">1. Acceptance of Terms</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            By accessing and using Yay Schedule ("the Application"), you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you should not use the Application.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">2. Description of Service</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Yay Schedule is a local-first personal assistant application that allows users to manage schedules, take notes, and interact with AI models. The software is provided "as is" and operates primarily within your local web browser.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">3. User Responsibilities</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            You are entirely responsible for the data you input, the API keys you provide, and your use of third-party AI models. You agree to comply with the terms of service of any third-party APIs (such as OpenAI, Anthropic, or Gemini) that you integrate with the Application.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">4. Disclaimer of Warranties</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            The Application is provided on an "AS IS" and "AS AVAILABLE" basis without any warranties of any kind, express or implied. We do not guarantee that the application will be error-free, secure, or operate without interruption. Since data is stored locally, we are not responsible for any data loss that may occur on your device.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">5. Limitation of Liability</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            In no event shall the creators or maintainers of Yay Schedule be liable for any direct, indirect, incidental, special, consequential, or punitive damages arising out of your use of or inability to use the Application.
          </p>
        </section>
      </div>
    </div>
  );
}
