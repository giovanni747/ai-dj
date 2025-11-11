import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

export async function POST(request: Request) {
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

    const response = await fetch('http://127.0.0.1:5001/track_like', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'X-Clerk-User-Id': user.id, // Add Clerk user ID header
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        data || { error: 'Failed to save track like' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error saving track like:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: 500 }
    );
  }
}

