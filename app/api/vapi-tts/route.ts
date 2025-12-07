import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId = 'jennifer-playht' } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.VAPI_PRIVATE_KEY;
    if (!apiKey) {
      console.error('VAPI_PRIVATE_KEY not found in environment variables');
      return NextResponse.json(
        { error: 'VAPI API key not configured' },
        { status: 500 }
      );
    }

    // Call VAPI TTS API
    // Note: VAPI's API structure may vary. This is a generic implementation.
    // You may need to adjust the endpoint based on your VAPI setup.
    // Alternative: Use ElevenLabs directly for TTS (VAPI uses ElevenLabs under the hood)
    
    // Try VAPI endpoint first (adjust endpoint as needed for your VAPI account)
    let response;
    try {
      response = await fetch('https://api.vapi.ai/assistant/text-to-speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: voiceId,
          provider: 'playht', // or 'elevenlabs', 'azure', etc.
        }),
      });
      
      // If endpoint doesn't exist, try alternative format
      if (!response.ok && response.status === 404) {
        throw new Error('Endpoint not found, may need to configure VAPI differently');
      }
    } catch (fetchError) {
      // If VAPI endpoint fails, you might want to use ElevenLabs directly
      // or configure VAPI with a different endpoint
      throw new Error(`VAPI API request failed: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('VAPI API error:', response.status, errorText);
      return NextResponse.json(
        { error: `VAPI API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get audio blob from VAPI
    const audioBlob = await response.blob();

    // Return audio as response
    return new NextResponse(audioBlob, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBlob.size.toString(),
      },
    });
  } catch (error) {
    console.error('Error in VAPI TTS route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

