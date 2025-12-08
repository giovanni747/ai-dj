"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrackList } from "@/components/ui/track-list";
import { DragCards } from "@/components/ui/drag-cards";
import { EmotionSettings } from "@/components/ui/emotion-settings";
import type { SpotifyTrack } from "@/types";
import { UserButton } from "@clerk/nextjs";

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
        throw new Error('Failed to fetch liked tracks');
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

  const handleLike = async (trackId: string) => {
    try {
      const response = await fetch('/api/like-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_id: trackId }),
        credentials: 'include',
      });

      if (response.ok) {
        setLikedTrackIds(prev => new Set([...prev, trackId]));
      }
    } catch (error) {
      console.error('Error liking track:', error);
    }
  };

  const handleDislike = async (trackId: string) => {
    try {
      const response = await fetch('/api/dislike-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_id: trackId }),
        credentials: 'include',
      });

      if (response.ok) {
        setLikedTrackIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(trackId);
          return newSet;
        });
        
        // Remove from list
        setLikedTracks(prev => prev.filter(track => track.id !== trackId));
      }
    } catch (error) {
      console.error('Error disliking track:', error);
    }
  };

  return (
    <div className="h-full w-full overflow-auto p-6 relative">
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
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white/20"></div>
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
                onToggleLike={(trackId) => {
                  if (likedTrackIds.has(trackId)) {
                    handleDislike(trackId);
                  } else {
                    handleLike(trackId);
                  }
                }}
              />
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

