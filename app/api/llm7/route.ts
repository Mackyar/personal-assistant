import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'https://www.yayschedule.com',
  'https://yayschedule.com',
  'http://localhost:3000',
  'http://localhost:3001',
];

const MAX_BODY_SIZE = 64 * 1024; // 64KB max per request

// Proxy LLM7.io requests server-side to avoid CORS issues
export async function POST(req: NextRequest) {
  // Origin validation — block external/bot abuse of this relay
  const origin = req.headers.get('origin') || req.headers.get('referer') || '';
  const isAllowed = ALLOWED_ORIGINS.some((o) => origin.startsWith(o));
  if (!isAllowed && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Body size check
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }

  try {
    const body = await req.json();
    const { apiKey = '', model = 'gpt-5.4-mini', messages, stream = false } = body;

    // Basic validation
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    const response = await fetch('https://api.llm7.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'YaySchedule/1.0',
      },
      body: JSON.stringify({ model, messages, stream }),
    });

    if (!response.ok) {
      console.error(`LLM7 upstream error: ${response.status}`);
      return NextResponse.json(
        { error: `AI service returned an error. Please try again.` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    // Log full error server-side, return generic message to client
    console.error('LLM7 proxy error:', err);
    return NextResponse.json({ error: 'Internal proxy error. Please try again.' }, { status: 500 });
  }
}
