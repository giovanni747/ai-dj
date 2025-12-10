"use client";

import { MorphicNavbar } from "@/components/kokonutui/morphic-navbar";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { HeroWave } from "@/components/ui/ai-input-hero";
import { useState, useEffect } from "react";
import { TrackList } from "@/components/ui/track-list";
import { DragCards } from "@/components/ui/drag-cards";
import type { SpotifyTrack } from "@/types";
import { motion } from "framer-motion";
import { Music } from "lucide-react";

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
  const [unlikedTrack, setUnlikedTrack] = useState<SpotifyTrack | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);

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

  const handleToggleLike = async (trackId: string) => {
    try {
      // Find the track to get its details
      const track = likedTracks.find(t => t.id === trackId);
      if (!track) {
        console.error('Track not found:', trackId);
        return;
      }

      // Call the API to toggle like (unlike in this case since it's already liked)
      const response = await fetch('/api/track-like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          track_id: trackId,
          track_name: track.name,
          track_artist: track.artist,
          track_image_url: track.album.images?.[0]?.url || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to unlike track:', errorData);
        return;
      }

      const data = await response.json();
      
      // If track was unliked (liked: false), remove it from the list
      if (data.liked === false) {
        // Store the unliked track for undo
        setUnlikedTrack(track);
        
        // Clear any existing undo timeout
        if (undoTimeout) {
          clearTimeout(undoTimeout);
        }
        
        // Set a timeout to clear the undo option after 5 seconds
        const timeout = setTimeout(() => {
          setUnlikedTrack(null);
        }, 5000);
        setUndoTimeout(timeout);
        
        setLikedTracks(prevTracks => {
          const updated = prevTracks.filter(t => t.id !== trackId);
          // Update positions
          return updated.map((t, index) => ({
            ...t,
            position: index + 1,
          }));
        });
        setLikedTrackIds(prev => {
          const updated = new Set(prev);
          updated.delete(trackId);
          return updated;
        });
        console.log('✅ Track removed from liked songs');
      }
    } catch (err) {
      console.error('❌ Error toggling like:', err);
    }
  };

  const handleUndoUnlike = async () => {
    if (!unlikedTrack) return;

    try {
      // Re-like the track
      const response = await fetch('/api/track-like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          track_id: unlikedTrack.id,
          track_name: unlikedTrack.name,
          track_artist: unlikedTrack.artist,
          track_image_url: unlikedTrack.album.images?.[0]?.url || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to re-like track:', errorData);
        return;
      }

      const data = await response.json();
      
      // If track was re-liked (liked: true), add it back to the list
      if (data.liked === true) {
        setLikedTracks(prevTracks => {
          // Add the track back at its original position (or at the end)
          const updated = [...prevTracks, unlikedTrack];
          // Update positions
          return updated.map((t, index) => ({
            ...t,
            position: index + 1,
          }));
        });
        setLikedTrackIds(prev => {
          const updated = new Set(prev);
          updated.add(unlikedTrack.id);
          return updated;
        });
        
        // Clear undo state
        setUnlikedTrack(null);
        if (undoTimeout) {
          clearTimeout(undoTimeout);
          setUndoTimeout(null);
        }
        
        console.log('✅ Track re-added to liked songs');
      }
    } catch (err) {
      console.error('❌ Error re-liking track:', err);
    }
  };

  useEffect(() => {
    fetchLikedTracks();
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeout) {
        clearTimeout(undoTimeout);
      }
    };
  }, [undoTimeout]);

  return (
    <div className="relative min-h-screen">
      {/* Hero background */}
      <HeroWave showOverlay={false} />

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
                  {/* Undo Notification */}
                  {unlikedTrack && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
                    >
                      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded overflow-hidden bg-white/5">
                            {unlikedTrack.album.images?.[0]?.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={unlikedTrack.album.images[0].url}
                                alt={unlikedTrack.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/40">
                                <Music className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              Removed "{unlikedTrack.name}"
                            </p>
                            <p className="text-xs text-white/60">
                              by {unlikedTrack.artist}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleUndoUnlike}
                          className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                        >
                          Undo
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Header - matching welcome page style */}
                  <div className="text-center space-y-3 mt-0">
                    <div className="flex items-center justify-center gap-4">
                      <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                        Your Liked Songs
                      </h1>
                      {/* User Button for logout and account management */}
                      <SignedIn>
                        <div className="pointer-events-auto">
                          <UserButton afterSignOutUrl="/" />
                        </div>
                      </SignedIn>
                    </div>
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
                          className="w-full mt-8 p-6 rounded-3xl bg-gray-800/40 backdrop-blur-xl border border-white/10 shadow-xl"
                        >
                          <TrackList
                            tracks={likedTracks}
                            likedTracks={likedTrackIds}
                            onToggleLike={handleToggleLike}
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

