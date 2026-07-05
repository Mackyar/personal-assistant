'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { createConversation } from '@/lib/db/conversations';

export default function ChatIndexPage() {
  const router = useRouter();
  const creating = useRef(false);

  useEffect(() => {
    if (creating.current) return;
    creating.current = true;
    async function init() {
      const conv = await createConversation();
      router.replace(`/chat/${conv.id}`);
    }
    init();
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="thinking-dot" />
        <span className="thinking-dot" />
        <span className="thinking-dot" />
      </div>
    </div>
  );
}
