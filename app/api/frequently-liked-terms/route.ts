import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const { searchParams } = new URL(request.url);
  const minOccurrences = searchParams.get('min_occurrences') || '2';
  
  try {
    // Get Clerk user
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated with Clerk' },
        { status: 401 }
      );
    }

    const response = await fetch(`http://127.0.0.1:5001/frequently_liked_terms?min_occurrences=${minOccurrences}`, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'X-Clerk-User-Id': user.id, // Add Clerk user ID header
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        data || { error: 'Failed to fetch frequently liked terms' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching frequently liked terms:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: 500 }
    );
  }
}

