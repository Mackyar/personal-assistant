import { NextRequest, NextResponse } from 'next/server';

// Proxy LLM7.io requests server-side to avoid CORS issues
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { model = 'gpt-4.1-mini', messages, stream = false } = body;

    const response = await fetch('https://llm7.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer not-required',
        'User-Agent': 'YaySchedule/1.0',
      },
      body: JSON.stringify({ model, messages, stream }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `LLM7 error: ${response.status} ${errText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Proxy error: ${msg}` }, { status: 500 });
  }
}
