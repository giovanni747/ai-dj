import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

/**
 * API route to get the current Clerk user
 * This is used by the backend to identify users for chat history
 */
export async function GET() {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Return essential user info
    return NextResponse.json({
      clerk_id: user.id,
      email: user.emailAddresses[0]?.emailAddress || null,
      name: user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.firstName || user.username || 'User',
    });
  } catch (error) {
    console.error('Error getting Clerk user:', error);
    return NextResponse.json(
      { error: 'Failed to get user info' },
      { status: 500 }
    );
  }
}

