"use server";

import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // Check if DATABASE_URL is set
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      return NextResponse.json({ 
        error: "DATABASE_URL not configured",
        hasDatabase: false 
      }, { status: 500 });
    }

    const sql = neon(databaseUrl);
    
    // Test the database connection
    const result = await sql`SELECT NOW() as current_time`;
    
    return NextResponse.json({ 
      connected: true,
      databaseTime: result[0]?.current_time,
      message: "Successfully connected to Neon database"
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      connected: false 
    }, { status: 500 });
  }
}

