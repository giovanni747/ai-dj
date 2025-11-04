import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Get cookies from request
  const cookieHeader = request.headers.get('cookie') || '';
  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Forward the request to Flask backend
    const response = await fetch('http://127.0.0.1:5001/dj_recommend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader, // Forward cookies
      },
      body: JSON.stringify({ message }),
    });

    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch {}

    if (response.ok) {
      return NextResponse.json(data ?? {});
    }

    // Bubble up backend error details to the client
    return NextResponse.json(
      data ?? { error: text || 'Failed to get recommendations' },
      { status: response.status }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: 500 }
    );
  }
}

