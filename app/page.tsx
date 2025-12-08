"use client";

import { AIInputWithLoadingDemo } from "@/components/ui/ai-input-demo";
import { useState, useEffect, useCallback } from "react";
import { HeroWave } from "@/components/ui/ai-input-hero";
import { SignedOut, SignInButton } from "@clerk/nextjs";
import type { AuthResponse } from "@/types";

export default function Home() {
  const [spotifyConnected, setSpotifyConnected] = useState<boolean>(false);

  const checkSpotifyConnection = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify-auth', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data: AuthResponse = await response.json();
        setSpotifyConnected(data.authenticated);
      } else {
        setSpotifyConnected(false);
      }
    } catch (error) {
      console.error('Spotify connection check failed:', error);
      setSpotifyConnected(false);
    }
  }, []);

  // Initial connection check on mount
  useEffect(() => {
    checkSpotifyConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check URL params for Spotify auth redirect from Flask
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('auth');
    const sessionId = params.get('session_id');
    const error = params.get('error');
    
    if (authStatus === 'success' && sessionId) {
      // Set cookie server-side to ensure SSR/API routes can read it
      fetch(`/api/set-session?session_id=${encodeURIComponent(sessionId)}`, { method: 'GET', credentials: 'include' })
        .then(() => {
          // Clean URL
          window.history.replaceState({}, '', '/');
          // Re-check Spotify connection
          checkSpotifyConnection();
        })
        .catch((e) => {
          console.error('Failed to set session cookie:', e);
          window.history.replaceState({}, '', '/');
        });
    } else if (error) {
      console.error('Spotify auth error:', error);
      window.history.replaceState({}, '', '/');
    }
  }, [checkSpotifyConnection]);

  return (
    <div className="relative min-h-screen">
      {/* Hero background */}
      <HeroWave showOverlay={false} />
      
      {/* User button removed from here - moved to Personal tab */}
      {/* <SignedIn>
        <div className="fixed top-4 right-4 z-50 pointer-events-auto">
          <UserButton afterSignOutUrl="/" />
        </div>
      </SignedIn> */}
      
      {/* Sign In button in top right when signed out - keep this for access */}
      <SignedOut>
        <div className="fixed top-4 right-4 z-50 pointer-events-auto">
          <SignInButton mode="modal">
            <button className="bg-white hover:bg-gray-100 text-black font-medium px-4 py-2 rounded-full transition-colors shadow-lg text-sm">
              Sign In
            </button>
          </SignInButton>
        </div>
      </SignedOut>
      
      {/* Main app always visible */}
      <div className="relative z-10">
        <AIInputWithLoadingDemo 
          spotifyConnected={spotifyConnected}
          onSpotifyReconnect={checkSpotifyConnection}
        />
      </div>
    </div>
  );
}
