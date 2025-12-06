import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

export async function POST(request: Request) {
  // Get cookies from request
  const cookieHeader = request.headers.get('cookie') || '';
  
  try {
    // Get Clerk user
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated with Clerk' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { message, tool, location } = body;

    console.log('🌤️ [WEATHER DEBUG API] Received request:', { 
      message: message?.substring(0, 50), 
      tool, 
      location 
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Forward the request to Flask backend with Clerk user ID
    console.log('🌤️ [WEATHER DEBUG API] Forwarding to Flask backend with:', { 
      tool, 
      hasLocation: !!location,
      location 
    });
    
    const response = await fetch('http://127.0.0.1:5001/dj_recommend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader, // Forward cookies for Spotify session
        'X-Clerk-User-Id': user.id, // Add Clerk user ID header
      },
      body: JSON.stringify({ 
        message, 
        tool: tool || null,
        location: location || null
      }),
    });

    const text = await response.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch {}

    if (response.ok) {
      return NextResponse.json(data ?? {});
    }

    // Bubble up backend error details to the client
    return NextResponse.json(
      data ?? { error: text || 'Failed to get recommendations' },
      { status: response.status }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: 500 }
    );
  }
}

