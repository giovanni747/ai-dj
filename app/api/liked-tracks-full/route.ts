import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

export async function GET(request: Request) {
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

    // Get query parameters for pagination
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const response = await fetch(
      `http://127.0.0.1:5001/liked_tracks?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        headers: {
          'Cookie': cookieHeader,
          'X-Clerk-User-Id': user.id,
        },
        credentials: 'include',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        errorData || { error: 'Failed to fetch liked tracks' },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Backend returns { tracks: [...], total: number }
    // Return just the tracks array for consistency
    return NextResponse.json(data.tracks || []);
  } catch (error) {
    console.error('Error fetching liked tracks:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: 500 }
    );
  }
}

