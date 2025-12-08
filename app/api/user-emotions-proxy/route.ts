import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

const BACKEND_URL = 'http://127.0.0.1:5001';

export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const response = await fetch(`${BACKEND_URL}/user_emotions`, {
      headers: { 'X-Clerk-User-Id': user.id },
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Backend error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    
    const response = await fetch(`${BACKEND_URL}/user_emotions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Clerk-User-Id': user.id 
      },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Backend error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const response = await fetch(`${BACKEND_URL}/user_emotions/${id}`, {
      method: 'DELETE',
      headers: { 'X-Clerk-User-Id': user.id },
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Backend error' }, { status: 500 });
  }
}

