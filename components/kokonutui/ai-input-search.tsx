"use client";

/**
 * @author: @kokonutui
 * @description: AI Input Search
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Send } from "lucide-react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";

interface AIInputSearchProps {
  onSubmit?: (value: string) => void | Promise<void>;
  spotifyConnected?: boolean;
  onSpotifyClick?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function AIInputSearch({
  onSubmit,
  spotifyConnected = false,
  onSpotifyClick,
  placeholder = "Describe what music you want to discover...",
  disabled = false,
}: AIInputSearchProps) {
  const [value, setValue] = useState("");
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 72,
    maxHeight: 240,
  });
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!value.trim() || isSubmitting || disabled) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit?.(value);
      setValue("");
      adjustHeight(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleContainerClick = () => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="w-full py-4">
      <div className="relative w-full mx-auto">
        <div
          role="textbox"
          tabIndex={0}
          aria-label="AI input container"
          className={cn(
            "relative flex flex-col rounded-2xl transition-all duration-200 w-full text-left",
            !disabled && "cursor-text",
            "ring-1 ring-white/10",
            isFocused && !disabled && "ring-white/20",
            "bg-white/5 backdrop-blur-md border border-white/10",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onClick={handleContainerClick}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !disabled) {
              handleContainerClick();
            }
          }}
        >
          <div className="overflow-y-auto max-h-[240px]">
            <Textarea
              id="ai-input-search"
              value={value}
              placeholder={placeholder}
              disabled={disabled || isSubmitting}
              className={cn(
                "w-full rounded-2xl rounded-b-none px-6 py-5",
                "bg-transparent border-none",
                "text-white placeholder:text-white/50",
                "resize-none focus-visible:ring-0 leading-relaxed",
                "text-base"
              )}
              ref={textareaRef}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              onChange={(e) => {
                setValue(e.target.value);
                adjustHeight();
              }}
            />
          </div>

          <div className="h-14 bg-white/5 backdrop-blur-md border-t border-white/10 rounded-b-2xl relative">
            {/* Left side - Spotify Connect button for new users */}
            <div className="absolute left-4 bottom-3.5 flex items-center gap-2">
              {!spotifyConnected && onSpotifyClick && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSpotifyClick();
                  }}
                  className={cn(
                    "rounded-lg px-3 py-2 transition-all flex items-center gap-2",
                    "bg-green-500/20 hover:bg-green-500/30 border border-green-500/30",
                    "text-green-400 text-sm font-medium",
                    "backdrop-blur-sm"
                  )}
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
                  </svg>
                  <span>Connect Spotify</span>
                </button>
              )}
            </div>

            {/* Right side - Send button */}
            <div className="absolute right-4 bottom-3.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSubmit();
                }}
                disabled={!value.trim() || isSubmitting || disabled}
                className={cn(
                  "rounded-lg p-2.5 transition-all",
                  value.trim() && !isSubmitting && !disabled
                    ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 cursor-pointer"
                    : "bg-white/5 text-white/30 cursor-not-allowed",
                  "backdrop-blur-sm"
                )}
              >
                {isSubmitting ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                  />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
