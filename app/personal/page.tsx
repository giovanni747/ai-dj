"use client";

import { MorphicNavbar } from "@/components/kokonutui/morphic-navbar";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { HeroWave } from "@/components/ui/ai-input-hero";
import { useState, useEffect } from "react";
import { TrackList } from "@/components/ui/track-list";
import { DragCards } from "@/components/ui/drag-cards";
import type { SpotifyTrack } from "@/types";
import { motion } from "framer-motion";

interface LikedTrack {
  id: number;
  track_id: string;
  track_name: string;
  track_artist: string;
  track_image_url: string | null;
  created_at: string | null;
}

export default function PersonalPage() {
  const [likedTracks, setLikedTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());

  const fetchLikedTracks = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch liked tracks from Next.js API route
      const response = await fetch('/api/liked-tracks-full', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please sign in to view your liked tracks');
          setLoading(false);
          return;
        }
        throw new Error('Failed to fetch liked tracks');
      }

      const tracksData: LikedTrack[] = await response.json();
      console.log('✅ Fetched liked tracks:', tracksData);
      console.log('✅ Number of tracks:', tracksData.length);

      // Convert to SpotifyTrack format
      const tracks: SpotifyTrack[] = tracksData.map((track, index) => ({
        position: index + 1,
        id: track.track_id,
        name: track.track_name,
        artist: track.track_artist,
        artists: track.track_artist.split(',').map(artist => ({
          name: artist.trim(),
          id: '',
        })),
        album: {
          name: '',
          images: track.track_image_url ? [{ url: track.track_image_url }] : [],
        },
        preview_url: null,
        external_url: `https://open.spotify.com/track/${track.track_id}`,
        duration_ms: 0,
        popularity: 0,
      }));

      setLikedTracks(tracks);
      setLikedTrackIds(new Set(tracks.map(t => t.id)));
      console.log('✅ Converted to SpotifyTrack format:', tracks.length, 'tracks');
    } catch (err) {
      console.error('❌ Error fetching liked tracks:', err);
      if (err instanceof Error) {
        console.error('❌ Error message:', err.message);
        setError(`Failed to load liked tracks: ${err.message}`);
      } else {
        setError('Failed to load liked tracks. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLikedTracks();
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* Hero background */}
      <HeroWave showOverlay={false} />
      
      {/* User button in top right when signed in */}
      <SignedIn>
        <div className="fixed top-4 right-4 z-50 pointer-events-auto">
          <UserButton afterSignOutUrl="/" />
        </div>
      </SignedIn>
      
      {/* Sign In button in top right when signed out */}
      <SignedOut>
        <div className="fixed top-4 right-4 z-50 pointer-events-auto">
          <SignInButton mode="modal">
            <button className="bg-white hover:bg-gray-100 text-black font-medium px-4 py-2 rounded-full transition-colors shadow-lg text-sm">
              Sign In
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      {/* Main content - matching welcome page structure */}
      <div className="relative z-10 min-h-screen p-2">
        <div className="relative flex flex-col max-w-7xl w-full mx-auto min-h-[calc(100vh-1rem)]">
          {/* Main Chat Area - matching welcome page */}
          <div className="relative flex flex-col min-h-[calc(100vh-1rem)] bg-[#0F0F0F] rounded-3xl overflow-hidden shadow-2xl border border-white/5">
            {/* Navbar - centered in this container */}
            <div className="absolute top-4 left-0 right-0 z-30 flex justify-center pointer-events-none">
              <div className="pointer-events-auto">
                <MorphicNavbar />
              </div>
            </div>

            {/* Content container - matching welcome page */}
            <div className="absolute inset-0 no-scrollbar overflow-y-auto z-0">
              <div className="pt-[10vh] pb-20 flex flex-col justify-start min-h-full">
                <div className="max-w-4xl w-full mx-auto flex flex-col gap-8 px-4 md:px-12">
                  {/* Header - matching welcome page style */}
                  <div className="text-center space-y-3 mt-0">
                    <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                      Your Liked Songs
                    </h1>
                    <p className="text-base text-white/60 max-w-md mx-auto">
                      {loading ? 'Loading...' : `${likedTracks.length} ${likedTracks.length === 1 ? 'song' : 'songs'} in your collection`}
                    </p>
                  </div>

                  {/* Content */}
                  <SignedIn>
                    {loading ? (
                      <div className="text-center text-white/60 py-20">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        <p className="mt-4">Loading your liked songs...</p>
                      </div>
                    ) : error ? (
                      <div className="text-center p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md">
                        <p className="text-white/80 text-lg mb-2">{error}</p>
                        <button
                          onClick={fetchLikedTracks}
                          className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                        >
                          Try Again
                        </button>
                      </div>
                    ) : likedTracks.length === 0 ? (
                      <div className="text-center p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md p-8">
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          strokeWidth={1.5} 
                          stroke="currentColor"
                          className="w-16 h-16 mx-auto mb-4 text-white/40"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                        </svg>
                        <p className="text-white/80 text-lg mb-2">No liked songs yet</p>
                        <p className="text-white/60 text-sm">
                          Start liking songs from your recommendations to see them here!
                        </p>
                      </div>
                    ) : (
                      <div className="relative w-full min-h-[600px]">
                        {/* Draggable Cards Background */}
                        <div className="relative w-full h-[600px] md:h-[800px] rounded-3xl overflow-hidden bg-gradient-to-br from-neutral-900 to-neutral-950">
                          <DragCards tracks={likedTracks} />
                        </div>
                        
                        {/* Track List Below */}
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                          className="w-full mt-8"
                        >
                          <TrackList
                            tracks={likedTracks}
                            likedTracks={likedTrackIds}
                          />
                        </motion.div>
                      </div>
                    )}
                  </SignedIn>

                  <SignedOut>
                    <div className="text-center p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md p-8">
                      <p className="text-white/80 text-lg mb-4">
                        Please sign in to view your liked songs
                      </p>
                      <SignInButton mode="modal">
                        <button className="bg-white hover:bg-gray-100 text-black font-medium px-6 py-3 rounded-full transition-colors shadow-lg">
                          Sign In
                        </button>
                      </SignInButton>
                    </div>
                  </SignedOut>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

