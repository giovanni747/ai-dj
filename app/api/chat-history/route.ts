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

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    
    const response = await fetch(`http://127.0.0.1:5001/clerk_chat_history?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'X-Clerk-User-Id': user.id, // Add Clerk user ID header
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        errorData || { error: 'Failed to fetch chat history' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: 500 }
    );
  }
}

