import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// This is your Flask backend's URL
// Use localhost instead of 127.0.0.1 for better Safari compatibility
const FLASK_BACKEND_URL = 'http://localhost:5001/get_user';

export async function GET(request: Request) {
  // 1. Get the cookie store - cookies() is async in Next.js 16+
  const cookieStore: any = await cookies();
  
  // DEBUG: Log all cookies
  console.log('=== SPOTIFY-AUTH API DEBUG ===');
  console.log('Request URL:', request.url);
  console.log('All cookies:', Object.keys(cookieStore._parsed || {}));
  
  // 2. Find the session ID cookie
  const sessionCookie = cookieStore.get('spotify_session_id');
  
  console.log('Session cookie found:', !!sessionCookie);
  if (sessionCookie) {
    console.log('Session cookie value:', sessionCookie.value.substring(0, 20) + '...');
  }

  if (!sessionCookie) {
    console.log('ERROR: No session cookie found');
    // If no cookie, user is not authenticated
    return NextResponse.json({ authenticated: false, error: 'No session cookie found' }, { status: 401 });
  }

  try {
    console.log('Calling Flask backend with session_id:', sessionCookie.value.substring(0, 20) + '...');
    
    // 3. Forward the request to Flask, passing the cookie
    const response = await fetch(FLASK_BACKEND_URL, {
      headers: {
        // 4. This is the crucial part: pass the cookie to the Flask backend
        'Cookie': `spotify_session_id=${sessionCookie.value}`
      }
    });

    console.log('Flask response status:', response.status);
    const data = await response.json();
    console.log('Flask response data:', data);

    if (!response.ok) {
      // If Flask says not authenticated, pass that info along
      console.log('Flask authentication failed:', data.error);
      return NextResponse.json({ authenticated: false, error: data.error || 'Flask auth failed' }, { status: response.status });
    }

    // 5. Get the user data from Flask and send it back to the Next.js frontend
    console.log('Authentication successful!');
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error('Error in API proxy:', error);
    return NextResponse.json({ authenticated: false, error: 'Proxy request failed' }, { status: 500 });
  }
}

