"use client";

import { CornerRightUp } from "lucide-react";
import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAutoResizeTextarea } from "@/components/hooks/use-auto-resize-textarea";
import { Typewriter } from "@/components/ui/typewriter";
import { Spinner } from "@/components/ui/spinner";

interface AIInputWithLoadingProps {
  id?: string;
  minHeight?: number;
  maxHeight?: number;
  loadingDuration?: number;
  thinkingDuration?: number;
  onSubmit?: (value: string) => void | Promise<void>;
  className?: string;
  autoAnimate?: boolean;
  spotifyConnected?: boolean;
  onSpotifyClick?: () => void;
}

export function AIInputWithLoading({
  id = "ai-input-with-loading",
  minHeight = 56,
  maxHeight = 200,
  loadingDuration = 3000,
  thinkingDuration = 1000,
  onSubmit,
  className,
  autoAnimate = false,
  spotifyConnected = false,
  onSpotifyClick
}: AIInputWithLoadingProps) {
  const [inputValue, setInputValue] = useState("");
  const [submitted, setSubmitted] = useState(autoAnimate);
  const [isAnimating, setIsAnimating] = useState(autoAnimate);
  
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight,
    maxHeight,
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const runAnimation = () => {
      if (!isAnimating) return;
      setSubmitted(true);
      timeoutId = setTimeout(() => {
        setSubmitted(false);
        timeoutId = setTimeout(runAnimation, thinkingDuration);
      }, loadingDuration);
    };

    if (isAnimating) {
      runAnimation();
    }

    return () => clearTimeout(timeoutId);
  }, [isAnimating, loadingDuration, thinkingDuration]);

  const handleSubmit = async () => {
    if (!inputValue.trim() || submitted) return;
    
    setSubmitted(true);
    await onSubmit?.(inputValue);
    setInputValue("");
    adjustHeight(true);
    
    setTimeout(() => {
      setSubmitted(false);
    }, loadingDuration);
  };

  return (
    <div className={cn("w-full py-4", className)}>
      <div className="relative w-full mx-auto flex items-start flex-col gap-2">
        <div className="relative w-full mx-auto">
          <div className="relative">
            <Textarea
              id={id}
              placeholder=""
              className={cn(
                "w-full rounded-3xl pl-6 py-4",
                spotifyConnected ? "pr-16" : "pr-20",
                "bg-white/5 text-white backdrop-blur-2xl border border-white/10",
                "ring-0 focus:ring-2 focus:ring-white/10 focus:outline-none",
                "resize-none text-wrap leading-normal break-word",
                "flex items-center",
                `min-h-[${minHeight}px]`
              )}
              data-caret-width="3"
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                adjustHeight();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={submitted}
            />
            {!inputValue && (
              <div className="absolute inset-0 flex items-center pl-6 pr-10 py-4 pointer-events-none">
                <Typewriter
                  text={[
                    "Create a playlist for a late night drive through the city",
                    "I need music for a workout session - something energetic and motivating",
                    "Play songs that capture the feeling of a summer sunset",
                    "Generate a mix for a cozy coffee shop atmosphere",
                    "I want music that sounds like rain on a Sunday morning",
                    "Create a playlist for a beach party with friends",
                    "Play songs that make me feel nostalgic about college days",
                    "I need upbeat tracks for a road trip adventure",
                    "Generate music for a romantic dinner at home",
                    "Play songs that capture the energy of a festival crowd",
                    "Create a mix for studying or working late at night",
                    "I want music that sounds like walking through a forest",
                    "Play songs that make me feel like I'm in a movie montage",
                    "Generate tracks for a yoga or meditation session",
                    "I need music that captures the vibe of a jazz club"
                  ]}
                  speed={60}
                  waitTime={3000}
                  deleteSpeed={40}
                  loop={true}
                  className="text-white/50 text-sm"
                  cursorChar="|"
                />
              </div>
            )}
          </div>
          {/* Spotify Connect Button - Inside input on the right */}
          {!spotifyConnected && onSpotifyClick && (
            <button
              onClick={onSpotifyClick}
              className="absolute right-11 top-1/2 -translate-y-1/2 rounded-xl py-1.5 px-2 bg-[#1DB954] hover:bg-[#1ed760] transition-colors"
              type="button"
              title="Connect Spotify"
            >
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.84-.179-.84-.66 0-.359.24-.66.54-.779 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.242 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
            </button>
          )}
          {/* Spotify Connected Indicator - Inside input on the right */}
          {spotifyConnected && (
            <div
              className="absolute right-11 top-1/2 -translate-y-1/2 rounded-xl py-1.5 px-2 bg-[#1DB954]/20 border border-[#1DB954]/30"
              title="Spotify Connected"
            >
              <svg className="w-4 h-4 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.84-.179-.84-.66 0-.359.24-.66.54-.779 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.242 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
            </div>
          )}
          <button
            onClick={handleSubmit}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 rounded-xl py-1 px-1 border",
              submitted ? "bg-none border-transparent" : "bg-white/10 border-white/20 backdrop-blur-md"
            )}
            type="button"
            disabled={submitted}
          >
            {submitted ? (
              <Spinner size="sm" className="text-white/70" />
            ) : (
              <CornerRightUp
                className={cn(
                  "w-4 h-4 transition-opacity text-white",
                  inputValue ? "opacity-100" : "opacity-30"
                )}
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
