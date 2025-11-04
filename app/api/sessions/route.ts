"use server";

import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

const sql = process.env.DATABASE_URL 
  ? neon(process.env.DATABASE_URL)
  : null;

export async function GET(request: Request) {
  if (!sql) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ authenticated: false });
    }

    // Get session from database
    const result = await sql`
      SELECT token_info, expires_at 
      FROM sessions 
      WHERE session_id = ${sessionId} 
      AND expires_at > NOW()
    `;

    if (result.length > 0) {
      return NextResponse.json({ 
        authenticated: true, 
        expires_at: result[0].expires_at 
      });
    }

    return NextResponse.json({ authenticated: false });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

