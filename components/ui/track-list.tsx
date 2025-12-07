"use client";

import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import type { SpotifyTrack } from "@/types";
import { formatDuration, getAlbumArt } from "@/lib/track-utils";
import { cn } from "@/lib/utils";
import { ExternalLink, Play, Pause, Music, Heart, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BlurredStagger } from "@/components/ui/blurred-stagger-text";
import { highlightLyricsTerms } from "@/lib/lyrics-highlight";
import { Button } from "@/components/ui/button";

interface TrackListProps {
  tracks: SpotifyTrack[];
  className?: string;
  likedTracks?: Set<string>;
  onToggleLike?: (trackId: string) => void;
  frequentlyLikedTerms?: Set<string>;
  onPlaybackChange?: (isPlaying: boolean) => void;
}

export function TrackList({ tracks, className = "", likedTracks = new Set(), onToggleLike, frequentlyLikedTerms = new Set(), onPlaybackChange }: TrackListProps) {
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set());
  const [showTranslatedLyrics, setShowTranslatedLyrics] = useState<Map<string, boolean>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Notify parent component of playback state changes
  useEffect(() => {
    if (onPlaybackChange) {
      onPlaybackChange(isPlaying);
    }
  }, [isPlaying, onPlaybackChange]);

  // Stop audio when component unmounts or track changes
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Debug: Log summary of tracks with EN button and non-English detection
  useEffect(() => {
    if (tracks && tracks.length > 0) {
      console.log('\n🌍 ===== LANGUAGE & EN BUTTON DETECTION =====');
      console.log(`Total tracks: ${tracks.length}`);
      
      const tracksWithLyrics = tracks.filter(t => t.lyrics);
      const englishTracks = tracks.filter(t => t.lyrics_language === 'en');
      const nonEnglishTracks = tracks.filter(t => t.lyrics_language && t.lyrics_language !== 'en');
      const translatedTracks = tracks.filter(t => t.lyrics_original && t.lyrics && t.lyrics_original !== t.lyrics);
      
      console.log(`Tracks with lyrics: ${tracksWithLyrics.length}`);
      console.log(`English tracks: ${englishTracks.length}`);
      console.log(`Non-English tracks (detected language): ${nonEnglishTracks.length}`);
      console.log(`Tracks with translation (original ≠ translated): ${translatedTracks.length}`);
      
      // Find tracks that should have EN button
      const tracksWithENButton = tracks.filter(track => {
        if (!track.lyrics) return false;
        const hasOriginal = !!track.lyrics_original;
        const hasTranslated = !!track.lyrics;
        const lyricsDiffer = track.lyrics_original && track.lyrics && track.lyrics_original !== track.lyrics;
        return hasOriginal && hasTranslated && lyricsDiffer;
      });

      console.log(`\n✅ Tracks WITH EN Button: ${tracksWithENButton.length}`);
      
      if (tracksWithENButton.length > 0) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        tracksWithENButton.forEach((track, idx) => {
          console.log(`${idx + 1}. 🎵 "${track.name}" by ${track.artist}`);
          console.log(`   🌐 Language: ${track.lyrics_language || 'unknown'}`);
          console.log(`   📝 Original length: ${track.lyrics_original?.length || 0} chars`);
          console.log(`   📄 Translated length: ${track.lyrics?.length || 0} chars`);
          console.log(`   ✓ Lyrics differ: ${track.lyrics_original !== track.lyrics}`);
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } else {
        console.log('⚠️  No tracks with EN button found!');
      }
      
      const tracksWithLyricsButNoButton = tracks.filter(track => {
        if (!track.lyrics) return false;
        const hasOriginal = !!track.lyrics_original;
        const hasTranslated = !!track.lyrics;
        const lyricsDiffer = track.lyrics_original && track.lyrics && track.lyrics_original !== track.lyrics;
        return !(hasOriginal && hasTranslated && lyricsDiffer);
      });
      
      if (tracksWithLyricsButNoButton.length > 0) {
        console.log(`\n❌ Tracks with lyrics but NO EN Button: ${tracksWithLyricsButNoButton.length}`);
        tracksWithLyricsButNoButton.forEach((track, idx) => {
          const reason = !track.lyrics_original ? 'No original lyrics stored' 
                       : !track.lyrics ? 'No translated lyrics'
                       : track.lyrics_original === track.lyrics ? 'Original = Translated (English song)'
                       : 'Unknown';
          console.log(`${idx + 1}. "${track.name}" - Language: ${track.lyrics_language || 'unknown'} | Reason: ${reason}`);
        });
      }
      
      console.log('============================================\n');
    }
  }, [tracks]);

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
                // eslint-disable-next-line @next/next/no-img-element
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
                {track.lyrics_score && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help ml-2">
                          <BlurredStagger 
                            text={`${Math.max(1, Math.min(5, Math.round(track.lyrics_score || 3)))}/5`}
                            className="text-sm font-bold text-[#F3E2A0]"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Match Score: How well this song matches your request (1-5)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
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
                  <div className="flex items-center justify-between">
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
                    {/* Right side buttons */}
                    <div className="flex items-center gap-2">
                    {/* Language toggle button - only show if lyrics are in a different language */}
                      {/* Show button if we have original lyrics (meaning translation happened) */}
                      {(() => {
                        const hasOriginal = !!track.lyrics_original;
                        const hasTranslated = !!track.lyrics;
                        
                        // Normalize for comparison (ignore minor whitespace differences)
                        const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim();
                        const lyricsDiffer = track.lyrics_original && track.lyrics && 
                          normalizeText(track.lyrics_original) !== normalizeText(track.lyrics);
                        
                        // Show EN button ONLY if:
                        // 1. Language is non-English
                        // 2. Both lyrics exist
                        // 3. Lyrics are meaningfully different
                        const isNonEnglish = track.lyrics_language && track.lyrics_language !== 'en';
                        const shouldShowENButton = isNonEnglish && hasOriginal && hasTranslated && lyricsDiffer;
                        
                        if (shouldShowENButton) {
                          const hasTranslation = lyricsDiffer;
                          const currentShowingTranslated = showTranslatedLyrics.get(track.id) ?? true;
                          
                          const buttonTitle = currentShowingTranslated 
                            ? `Showing English translation (click for ${track.lyrics_language?.toUpperCase() || 'original'})` 
                            : `Showing ${track.lyrics_language?.toUpperCase() || 'original'} (click for English)`;
                          
                          return (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 text-xs border-white/20 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (hasTranslation) {
                                  const newMap = new Map(showTranslatedLyrics);
                                  const currentValue = newMap.get(track.id) ?? true;
                                  newMap.set(track.id, !currentValue);
                                  setShowTranslatedLyrics(newMap);
                                }
                              }}
                              disabled={!hasTranslation}
                              title={buttonTitle}
                            >
                              <span className="text-[10px] font-medium">
                                {currentShowingTranslated ? 'EN' : track.lyrics_language?.toUpperCase() || 'OG'}
                              </span>
                              <span className="sr-only">Toggle language</span>
                            </Button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  {expandedTracks.has(`${track.id}-lyrics`) && (
                    <div className="mt-1 p-3 bg-white/5 rounded text-xs text-white/70 leading-relaxed max-h-60 overflow-y-auto overflow-x-hidden relative whitespace-pre-wrap">
                      {(() => {
                        const showingTranslated = showTranslatedLyrics.get(track.id) ?? true;
                        const lyricsToShow = showingTranslated && track.lyrics
                          ? track.lyrics
                          : (track.lyrics_original || track.lyrics || '');
                        
                        // Apply highlighting based on which version is shown
                        if (showingTranslated && track.lyrics) {
                          // Highlight English (translated) lyrics
                          return highlightLyricsTerms(
                            lyricsToShow,
                            track.highlighted_terms || [],
                            frequentlyLikedTerms
                          );
                        } else if (!showingTranslated && track.lyrics_original) {
                          // Highlight original language lyrics with original terms
                        return highlightLyricsTerms(
                          lyricsToShow,
                            track.highlighted_terms_original || [],
                          frequentlyLikedTerms
                        );
                        }
                        
                        // Fallback: show plain text if no highlighting available
                        return lyricsToShow;
                      })()}
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

