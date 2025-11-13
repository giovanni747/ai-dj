"use client";

import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import type { SpotifyTrack } from "@/types";
import { formatDuration, getAlbumArt } from "@/lib/track-utils";
import { cn } from "@/lib/utils";
import { ExternalLink, Play, Pause, Music, Heart, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { highlightLyricsTerms } from "@/lib/lyrics-highlight";

interface TrackListProps {
  tracks: SpotifyTrack[];
  className?: string;
  likedTracks?: Set<string>;
  onToggleLike?: (trackId: string) => void;
  frequentlyLikedTerms?: Set<string>;
}

export function TrackList({ tracks, className = "", likedTracks = new Set(), onToggleLike, frequentlyLikedTerms = new Set() }: TrackListProps) {
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stop audio when component unmounts or track changes
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlayPause = (track: SpotifyTrack) => {
    if (!track.preview_url) {
      console.log(`No preview available for: ${track.name}`);
      return;
    }

    // If clicking the same track, toggle play/pause
    if (playingTrackId === track.id && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
      return;
    }

    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Play new track
    const audio = new Audio(track.preview_url);
    audioRef.current = audio;
    setPlayingTrackId(track.id);
    setIsPlaying(true);

    audio.play().catch((error) => {
      console.error("Error playing preview:", error);
      setIsPlaying(false);
      setPlayingTrackId(null);
    });

    // Reset when audio ends
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setPlayingTrackId(null);
      audioRef.current = null;
    });

    // Handle errors
    audio.addEventListener("error", () => {
      console.error("Error loading preview for:", track.name);
      setIsPlaying(false);
      setPlayingTrackId(null);
      audioRef.current = null;
    });
  };

  if (!tracks || tracks.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {tracks.map((track, index) => {
        const isCurrentTrack = playingTrackId === track.id;
        const showPlayButton = track.preview_url && (isCurrentTrack || !isPlaying);

        return (
          <motion.div
            key={track.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={`group relative flex flex-col gap-2 p-3 rounded-lg hover:bg-white/5 transition-colors ${track.preview_url ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-center gap-3 w-full" onClick={() => handlePlayPause(track)}>
            {/* Position Number */}
            <div className="shrink-0 w-6 text-center text-xs font-semibold text-white/60">
              {track.position}
            </div>

            {/* Album Art with Play Button */}
            <div className={`relative shrink-0 w-12 h-12 rounded overflow-hidden bg-white/5 ${!track.preview_url ? 'opacity-60' : ''}`}>
              {track.album.images && track.album.images.length > 0 ? (
                <img
                  src={getAlbumArt(track.album.images, "small") || ""}
                  alt={track.album.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20">
                  <Play className="w-4 h-4" />
                </div>
              )}
            
              {/* Play/Pause button overlay */}
              {track.preview_url && (
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {isCurrentTrack && isPlaying ? (
                    <Pause className="w-5 h-5 text-white" />
                  ) : (
                    <Play className="w-5 h-5 text-white" />
                  )}
                </div>
              )}

              {/* Playing indicator */}
              {isCurrentTrack && isPlaying && (
                <div className="absolute inset-0 border-2 border-green-500/50 rounded pointer-events-none" />
              )}
            </div>

            {/* Track Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white truncate">
                  {track.name}
                </p>
                {track.popularity >= 70 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                    Popular
                  </span>
                )}
                {!track.preview_url && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/40 flex items-center gap-1">
                    <Music className="w-3 h-3" />
                    No preview
                  </span>
                )}
              </div>
              <p className="text-xs text-white/60 truncate">
                {track.artist}
              </p>
            </div>

            {/* Duration */}
            <div className="shrink-0 text-xs text-white/40">
              {formatDuration(track.duration_ms)}
            </div>

            {/* Heart Button */}
            {onToggleLike && (
              <button
                className="shrink-0 p-1 hover:scale-110 active:scale-95 transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLike(track.id);
                }}
                aria-label={likedTracks.has(track.id) ? "Unlike track" : "Like track"}
              >
                <Heart
                  className={cn(
                    "w-4 h-4 transition-colors",
                    likedTracks.has(track.id)
                      ? "text-red-500 fill-red-500"
                      : "text-white/40 hover:text-red-400"
                  )}
                />
              </button>
            )}

            {/* Spotify Link */}
            <a
              href={track.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-4 h-4 text-white/60 hover:text-white transition-colors" />
            </a>
            </div>
            
            {/* Lyrics Explanation and Lyrics - Below the track row */}
            <div className="w-full pl-16 space-y-2">
              {/* Lyrics Explanation */}
              {track.lyrics_explanation && (
                <div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newExpanded = new Set(expandedTracks);
                      if (newExpanded.has(track.id)) {
                        newExpanded.delete(track.id);
                      } else {
                        newExpanded.add(track.id);
                      }
                      setExpandedTracks(newExpanded);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  >
                    {expandedTracks.has(track.id) ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    <span>Why this song matches</span>
                  </button>
                  {expandedTracks.has(track.id) && (
                    <div className="mt-1 p-2 bg-white/5 rounded text-xs text-white/80 leading-relaxed">
                      {track.lyrics_explanation}
                    </div>
                  )}
                </div>
              )}
              
              {/* Lyrics */}
              {track.lyrics && (
                <div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newExpanded = new Set(expandedTracks);
                      const lyricsKey = `${track.id}-lyrics`;
                      if (newExpanded.has(lyricsKey)) {
                        newExpanded.delete(lyricsKey);
                      } else {
                        newExpanded.add(lyricsKey);
                      }
                      setExpandedTracks(newExpanded);
                    }}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                  >
                    <FileText className="w-3 h-3" />
                    {expandedTracks.has(`${track.id}-lyrics`) ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        <span>Hide lyrics</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        <span>Show lyrics</span>
                      </>
                    )}
                  </button>
                  {expandedTracks.has(`${track.id}-lyrics`) && (
                    <div className="mt-1 p-3 bg-white/5 rounded text-xs text-white/70 leading-relaxed max-h-60 overflow-y-auto overflow-x-hidden relative whitespace-pre-wrap">
                      {highlightLyricsTerms(
                        track.lyrics,
                        track.highlighted_terms || [],
                        frequentlyLikedTerms
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function CompactTrackList({ tracks, className = "" }: TrackListProps) {
  if (!tracks || tracks.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {tracks.map((track, index) => (
        <motion.div
          key={track.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: index * 0.03 }}
          className="flex items-center gap-2 text-xs"
        >
          <span className="text-white/40 w-4">{track.position}.</span>
          <span className="text-white/80 truncate flex-1">
            {track.name}
          </span>
          <span className="text-white/40 truncate max-w-[100px]">
            {track.artist}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

