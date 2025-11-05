import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  
  try {
    const body = await request.json();

    const response = await fetch('http://127.0.0.1:5001/message_feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        data || { error: 'Failed to save message feedback' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error saving message feedback:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: 500 }
    );
  }
}

