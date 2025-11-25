"use client";

import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { SpotifyTrack } from "@/types";
import { getAlbumArt } from "@/lib/track-utils";
import { highlightLyricsTerms } from "@/lib/lyrics-highlight";
import { Button } from "@/components/ui/button";

interface AnimatedTrackCarouselProps {
  tracks: SpotifyTrack[];
  className?: string;
  autoplay?: boolean;
}

export const AnimatedTrackCarousel = ({
  tracks,
  autoplay = false,
  className,
}: AnimatedTrackCarouselProps) => {
  const [active, setActive] = useState(0);
  const [expandedExplanations, setExpandedExplanations] = useState<Set<number>>(new Set());
  const [showTranslatedLyrics, setShowTranslatedLyrics] = useState<Map<string, boolean>>(new Map());

  const handleNext = () => {
    setActive((prev) => (prev + 1) % tracks.length);
  };

  const handlePrev = () => {
    setActive((prev) => (prev - 1 + tracks.length) % tracks.length);
  };

  const isActive = (index: number) => {
    return index === active;
  };

  useEffect(() => {
    if (autoplay) {
      const interval = setInterval(handleNext, 5000);
      return () => clearInterval(interval);
    }
  }, [autoplay]);

  const randomRotateY = () => {
    return Math.floor(Math.random() * 21) - 10;
  };

  if (!tracks || tracks.length === 0) {
    return null;
  }

  const activeTrack = tracks[active];

      return (
        <div className={cn("w-full max-w-5xl mx-auto px-4 py-8", className)}>
          <div className="relative grid grid-cols-1 md:grid-cols-[1fr,1.3fr] gap-8 md:gap-12 items-start">
        {/* Album Art Carousel */}
        <div className="sticky top-4">
          <div className="relative h-80 w-full">
            <AnimatePresence>
              {tracks.map((track, index) => {
                const imageUrl = getAlbumArt(track.album.images, "large") || 
                  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop";
                
                return (
                  <motion.div
                    key={track.id}
                    initial={{
                      opacity: 0,
                      scale: 0.9,
                      z: -100,
                      rotate: randomRotateY(),
                    }}
                    animate={{
                      opacity: isActive(index) ? 1 : 0.7,
                      scale: isActive(index) ? 1 : 0.95,
                      z: isActive(index) ? 0 : -100,
                      rotate: isActive(index) ? 0 : randomRotateY(),
                      zIndex: isActive(index)
                        ? 999
                        : tracks.length + 2 - index,
                      y: isActive(index) ? [0, -80, 0] : 0,
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.9,
                      z: 100,
                      rotate: randomRotateY(),
                    }}
                    transition={{
                      duration: 0.4,
                      ease: "easeInOut",
                    }}
                    className="absolute inset-0 origin-bottom"
                  >
                    <Image
                      src={imageUrl}
                      alt={`${track.name} by ${track.artist}`}
                      width={500}
                      height={500}
                      draggable={false}
                      className="h-full w-full rounded-3xl object-cover object-center"
                      unoptimized
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Track Info, Lyrics, and Explanation */}
        <div className="flex flex-col h-full min-h-[320px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{
                y: 20,
                opacity: 0,
              }}
              animate={{
                y: 0,
                opacity: 1,
              }}
              exit={{
                y: -20,
                opacity: 0,
              }}
              transition={{
                duration: 0.2,
                ease: "easeInOut",
              }}
              className="flex flex-col h-full"
            >
              {/* Track Name and Artist */}
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-white">
                  {activeTrack.name}
                </h3>
                <p className="text-sm text-white/60 mt-1">
                  {activeTrack.artist}
                </p>
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {/* Lyrics Explanation */}
                {activeTrack.lyrics_explanation && (() => {
                  const isExpanded = expandedExplanations.has(active);
                  const explanation = activeTrack.lyrics_explanation;
                  const previewLength = 120; // Show first 120 characters
                  const shouldTruncate = explanation.length > previewLength;
                  const displayText = isExpanded || !shouldTruncate 
                    ? explanation 
                    : explanation.substring(0, previewLength) + "...";
                  
                  return (
                    <div>
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">
                        Why this song matches:
                      </h4>
                      <motion.p 
                        className="text-sm text-white/80 leading-relaxed"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        {displayText}
                      </motion.p>
                      {shouldTruncate && (
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedExplanations);
                            if (isExpanded) {
                              newExpanded.delete(active);
                            } else {
                              newExpanded.add(active);
                            }
                            setExpandedExplanations(newExpanded);
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 mt-2 transition-colors"
                        >
                          {isExpanded ? "Show less" : "Read more"}
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Lyrics */}
                {activeTrack.lyrics && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-purple-400">
                        Lyrics:
                      </h4>
                      {/* Show button if we have original lyrics (meaning translation happened) */}
                      {activeTrack.lyrics_original && activeTrack.lyrics && activeTrack.lyrics_original !== activeTrack.lyrics && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 text-xs border-white/20 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newMap = new Map(showTranslatedLyrics);
                            const currentValue = newMap.get(activeTrack.id) ?? true; // Default to showing translated
                            newMap.set(activeTrack.id, !currentValue);
                            setShowTranslatedLyrics(newMap);
                          }}
                          title={showTranslatedLyrics.get(activeTrack.id) ?? true ? "Show original lyrics" : "Show English translation"}
                        >
                          <span className="text-[10px] font-medium">EN</span>
                          <span className="sr-only">Toggle language</span>
                        </Button>
                      )}
                    </div>
                    <div className="max-h-48 overflow-y-auto overflow-x-hidden relative bg-white/5 rounded-lg p-3">
                      <motion.p 
                        className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        {highlightLyricsTerms(
                          (showTranslatedLyrics.get(activeTrack.id) ?? true) && activeTrack.lyrics
                            ? activeTrack.lyrics
                            : (activeTrack.lyrics_original || activeTrack.lyrics || ''),
                          activeTrack.highlighted_terms || []
                        )}
                      </motion.p>
                    </div>
                  </div>
                )}
              </div>

              {/* Track Position Indicator and Navigation */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/40">
                    Track {activeTrack.position} of {tracks.length}
                  </div>
                  
                  {/* Navigation Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handlePrev}
                      className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center group/button transition-colors"
                      aria-label="Previous track"
                    >
                      <IconArrowLeft className="h-4 w-4 text-white group-hover/button:rotate-12 transition-transform duration-300" />
                    </button>
                    <button
                      onClick={handleNext}
                      className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center group/button transition-colors"
                      aria-label="Next track"
                    >
                      <IconArrowRight className="h-4 w-4 text-white group-hover/button:-rotate-12 transition-transform duration-300" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

