"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { TrackList } from "@/components/ui/track-list";
import { DragCards } from "@/components/ui/drag-cards";
import { EmotionSettings } from "@/components/ui/emotion-settings";
import type { SpotifyTrack } from "@/types";
import { UserButton } from "@clerk/nextjs";
import Loader from "@/components/kokonutui/loader";

interface LikedTrack {
  id: number;
  track_id: string;
  track_name: string;
  track_artist: string;
  track_image_url: string | null;
  preview_url: string | null;
  duration_ms: number | null;
  created_at: string | null;
}

export function PersonalTab() {
  const [likedTracks, setLikedTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Note: Removed auto-scroll - user should maintain their scroll position

  const fetchLikedTracks = async () => {
    try {
      setLoading(true);
      setError(null);

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
        
        // Try to get error message from response
        let errorMessage = 'Failed to fetch liked tracks';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use default message
        }
        
        throw new Error(errorMessage);
      }

      const tracksData: LikedTrack[] = await response.json();

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
        preview_url: track.preview_url || null,
        external_url: `https://open.spotify.com/track/${track.track_id}`,
        duration_ms: track.duration_ms || 0,
        popularity: 0,
      }));

      setLikedTracks(tracks);
      setLikedTrackIds(new Set(tracks.map(t => t.id)));
    } catch (err) {
      console.error('❌ Error fetching liked tracks:', err);
      if (err instanceof Error) {
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

  const handleToggleLike = async (trackId: string) => {
    try {
      // Find the track to get all required fields
      const track = likedTracks.find(t => t.id === trackId);
      if (!track) {
        console.error('Track not found:', trackId);
        return;
      }

      const response = await fetch('/api/track-like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: trackId,
          track_name: track.name,
          track_artist: track.artist,
          track_image_url: track.album?.images?.[0]?.url || null,
          preview_url: track.preview_url || null,
          duration_ms: track.duration_ms || null,
        }),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.liked) {
          // Track was liked - add to liked set
          setLikedTrackIds(prev => new Set([...prev, trackId]));
        } else {
          // Track was unliked - remove from liked set and list
          setLikedTrackIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(trackId);
            return newSet;
          });
          
          // Remove from displayed list
          setLikedTracks(prev => prev.filter(t => t.id !== trackId));
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to toggle track like:', errorData);
      }
    } catch (error) {
      console.error('Error toggling track like:', error);
    }
  };

  return (
    <div ref={scrollContainerRef} className="h-full w-full overflow-auto p-6 relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-4xl mx-auto relative z-20"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-white">Personal Hub</h2>
          <div className="scale-125">
            <UserButton 
              afterSignOutUrl="/" 
              appearance={{
                elements: {
                  avatarBox: "w-12 h-12 border-2 border-white/20 hover:border-white/40 transition-colors",
                  userButtonTrigger: "focus:shadow-none focus:outline-none",
                  userButtonPopoverCard: "bg-black/90 border border-white/10 shadow-2xl backdrop-blur-xl",
                  userButtonPopoverFooter: "hidden"
                }
              }} 
            />
          </div>
        </div>

        <EmotionSettings />

        <h3 className="text-2xl font-bold text-white mb-6">Your Liked Tracks</h3>
        
        {loading && (
          <div className="flex items-center justify-center min-h-[60vh] w-full">
            <Loader
              title="Loading your tracks..."
              subtitle="Fetching your liked songs"
              size="lg"
              className="text-white"
            />
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <p className="text-red-400 text-lg">{error}</p>
          </div>
        )}

        {!loading && !error && likedTracks.length === 0 && (
          <div className="text-center py-20">
            <p className="text-white/60 text-lg">No liked tracks yet. Start exploring music!</p>
          </div>
        )}

        {!loading && !error && likedTracks.length > 0 && (
          <div className="flex flex-col gap-8">
            {/* Draggable album art cards section */}
            <div className="relative w-full h-[400px] bg-white/5 rounded-3xl overflow-hidden border border-white/10">
              <div className="absolute inset-0 bg-linear-to-b from-transparent to-black/20 z-20 pointer-events-none" />
              <DragCards tracks={likedTracks} />
              <div className="absolute bottom-4 left-6 z-20">
                <p className="text-white/40 text-sm font-medium uppercase tracking-wider">Interactive Gallery</p>
              </div>
            </div>
            
            {/* Track list */}
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <div className="mb-4 px-2 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white/90">All Tracks</h3>
                <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-white/60">{likedTracks.length} songs</span>
              </div>
              <TrackList
                tracks={likedTracks}
                likedTracks={likedTrackIds}
                onToggleLike={handleToggleLike}
              />
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

