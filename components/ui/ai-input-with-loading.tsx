"use client";

import { CornerRightUp } from "lucide-react";
import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAutoResizeTextarea } from "@/components/hooks/use-auto-resize-textarea";
import { Typewriter } from "@/components/ui/typewriter";

interface AIInputWithLoadingProps {
  id?: string;
  minHeight?: number;
  maxHeight?: number;
  loadingDuration?: number;
  thinkingDuration?: number;
  onSubmit?: (value: string) => void | Promise<void>;
  className?: string;
  autoAnimate?: boolean;
}

export function AIInputWithLoading({
  id = "ai-input-with-loading",
  minHeight = 56,
  maxHeight = 200,
  loadingDuration = 3000,
  thinkingDuration = 1000,
  onSubmit,
  className,
  autoAnimate = false
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
      <div className="relative max-w-4xl w-full mx-auto flex items-start flex-col gap-2 px-4">
        <div className="relative max-w-4xl w-full mx-auto">
          <div className="relative">
            <Textarea
              id={id}
              placeholder=""
              className={cn(
                "w-full rounded-3xl pl-6 pr-10 py-4",
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
              <div
                className="w-4 h-4 bg-white/70 rounded-sm animate-spin transition duration-700"
                style={{ animationDuration: "3s" }}
              />
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
        <p className="pl-4 h-4 text-xs mx-auto text-gray-500">
          {submitted ? "Dj is mixing..." : "Ready to submit!"}
        </p>
      </div>
    </div>
  );
}
