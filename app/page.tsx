"use client";

import { AIInputWithLoadingDemo } from "@/components/ui/ai-input-demo";
import { useState, useEffect } from "react";
import { SpotifyAuthDialog } from "@/components/ui/spotify-auth-dialog";
import { HeroWave } from "@/components/ui/ai-input-hero";
import type { AuthResponse } from "@/types";
// Gradient background via CSS utility class

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    
    // Check URL params for auth redirect from Flask
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
          // Re-check auth state without full reload
          checkAuth();
        })
        .catch((e) => {
          console.error('Failed to set session cookie:', e);
          // Fallback: still clean URL to avoid loops
          window.history.replaceState({}, '', '/');
        });
    } else if (error) {
      // Show error in dialog
      console.error('Auth error:', error);
      setShowAuthDialog(true);
      // Clean URL
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/spotify-auth', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        setIsAuthenticated(false);
        return;
      }
      
      const data: AuthResponse = await response.json();
      setIsAuthenticated(data.authenticated);
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAttempt = async () => {
    // Check auth before allowing submit
    try {
      const response = await fetch('/api/spotify-auth', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        setShowAuthDialog(true);
        return false;
      }
      
      const data: AuthResponse = await response.json();
      
      if (!data.authenticated) {
        setShowAuthDialog(true);
        return false;
      }
      
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error('Auth check failed:', error);
      setShowAuthDialog(true);
      return false;
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="relative min-h-screen">
        {/* Hero background behind content */}
        <HeroWave showOverlay={false} />
        <div className="relative z-10 flex min-h-screen items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="animate-spin h-10 w-10 border-4 border-[#1DB954] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-600 text-sm">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Hero background behind content */}
      <HeroWave showOverlay={false} />
      <div className="relative z-10 flex min-h-screen items-center justify-center pointer-events-none">
        <div className="text-left w-full max-w-4xl px-4 pointer-events-auto">
          {/* Header (title removed per request) */}
          <div className="mb-6 text-center">
            {/* Title intentionally removed */}
          </div>
          
          <AIInputWithLoadingDemo onAuthRequired={handleSubmitAttempt} />
        </div>
      </div>
      
      {/* Auth Dialog - shows when user tries to submit without auth */}
      <SpotifyAuthDialog 
        open={showAuthDialog} 
        onOpenChange={setShowAuthDialog}
      />
    </div>
  );
}
