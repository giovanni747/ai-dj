"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { CornerRightUp, Settings2, X, Mic, Globe, Pencil, Sparkles, Lightbulb, Search, Cloud, Compass, Heart, Music, ChevronRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useAutoResizeTextarea } from "@/components/hooks/use-auto-resize-textarea";
import { Typewriter } from "@/components/ui/typewriter";
import { motion } from "framer-motion";

// --- Radix Primitives ---
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & { showArrow?: boolean }
>(({ className, sideOffset = 4, showArrow = false, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "relative z-50 max-w-[280px] rounded-lg border border-white/10 bg-black/80 backdrop-blur-xl text-white/90 px-1.5 py-1 text-xs shadow-lg animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    >
      {props.children}
      {showArrow && <TooltipPrimitive.Arrow className="-my-px fill-black/80" />}
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-48 rounded-xl bg-white/10 backdrop-blur-2xl border border-white/20 p-2 text-white shadow-md outline-none animate-in data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

// Tool type definition
interface Tool {
  id: string;
  name: string;
  shortName: string;
  icon: React.ComponentType<{ className?: string }>;
  hasSubmenu?: boolean;
  extra?: React.ReactNode;
}

// Tools list for the popover
const toolsList: Tool[] = [
  { id: 'discover', name: 'Discover', shortName: 'Discover', icon: Compass },
  { id: 'emotion', name: 'Emotion', shortName: 'Emotion', icon: Heart, hasSubmenu: true },
  { id: 'genres', name: 'Genres', shortName: 'Genres', icon: Music, hasSubmenu: true },
  { id: 'weather', name: 'Weather', shortName: 'Weather', icon: Cloud },
];

interface EmotionData {
  emotion: string;
  definition: string;
}

// Genres list
const genresList = [
  'Pop',
  'Rock',
  'Country',
  'Latin',
  'Hip-Hop',
  'R&B',
  'Jazz',
  'Electronic',
  'Classical',
  'Reggae',
  'Blues',
  'Folk',
  'Metal',
  'Punk',
  'Indie',
];

interface ChatGPTPromptInputProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onSubmit'> {
  onSubmit?: (value: string, selectedTool?: string | null) => void | Promise<void>;
  loadingDuration?: number;
  submitted?: boolean;
  spotifyConnected?: boolean;
  onSpotifyClick?: () => void;
  minHeight?: number;
  maxHeight?: number;
}

export const ChatGPTPromptInput = React.forwardRef<HTMLTextAreaElement, ChatGPTPromptInputProps>(
  ({
    className,
    onSubmit,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    loadingDuration: _loadingDuration,
    submitted = false,
    spotifyConnected = false,
    onSpotifyClick,
    minHeight = 56,
    maxHeight = 200,
    ...props
  }, ref) => {
    const internalTextareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [value, setValue] = React.useState("");
    const [selectedTool, setSelectedTool] = React.useState<string | null>(null);
    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
    const [showEmotionSubmenu, setShowEmotionSubmenu] = React.useState(false);
    const [showGenresSubmenu, setShowGenresSubmenu] = React.useState(false);
    const [emotionsData, setEmotionsData] = React.useState<EmotionData[]>([]);

    React.useEffect(() => {
      const fetchEmotions = async () => {
        try {
          const response = await fetch('/api/user-emotions-proxy', {
            credentials: 'include'
          });
          if (response.ok) {
            const data = await response.json();
            if (data.emotions && Array.isArray(data.emotions)) {
              setEmotionsData(data.emotions);
            }
          }
        } catch (error) {
          console.error("Failed to fetch user emotions:", error);
        }
      };

      fetchEmotions();
    }, []);

    const renderHighlightedText = (text: string) => {
      if (!emotionsData.length || !text) return <span>{text}</span>;

      const sortedEmotions = [...emotionsData].sort((a, b) => b.emotion.length - a.emotion.length);
      if (sortedEmotions.length === 0) return <span>{text}</span>;

      const pattern = new RegExp(`\\b(${sortedEmotions.map(e => e.emotion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');

      const parts = text.split(pattern);

      return (
        <>
          {parts.map((part, i) => {
            const match = sortedEmotions.find(e => e.emotion.toLowerCase() === part.toLowerCase());
            if (match) {
              // Calculate approximate width based on character count (in pixels)
              const charWidth = 8; // Approximate pixel width per character for text-sm
              const textWidth = Math.max(part.length * charWidth, 30); // Minimum width
              const midX = textWidth * 0.5;
              const midY = 3;
              return (
                <span key={i} className="relative inline-block">
                  <span className="text-white relative z-10">{part}</span>
                  <motion.svg
                    className="absolute bottom-0 left-0 pointer-events-none"
                    width={textWidth}
                    height="12"
                    style={{ overflow: 'visible', marginBottom: '4px' }}
                    viewBox={`0 0 ${textWidth} 12`}
                  >
                    <motion.path
                      d={`M -4 6 C -4 -16 ${textWidth + 4} -16 ${textWidth + 4} 6 C ${textWidth + 4} 28 -4 28 -4 6`}
                      fill="none"
                      strokeWidth="2"
                      stroke="white"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeOpacity="0.9"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.9 }}
                      transition={{
                        pathLength: { duration: 0.8, ease: "easeInOut" },
                        opacity: { duration: 0.3 }
                      }}
                    />
                  </motion.svg>
                </span>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </>
      );
    };

    const detectedEmotion = React.useMemo(() => {
      if (!value) return null;
      // Find the last typed emotion to show its definition
      // Or find all? Just showing one is cleaner.
      // Let's find the longest match
      const sortedEmotions = [...emotionsData].sort((a, b) => b.emotion.length - a.emotion.length);
      return sortedEmotions.find(e => new RegExp(`\\b${e.emotion}\\b`, 'i').test(value));
    }, [value, emotionsData]);

    const { adjustHeight } = useAutoResizeTextarea({
      minHeight,
      maxHeight,
    });

    React.useImperativeHandle(ref, () => internalTextareaRef.current!, []);

    React.useLayoutEffect(() => {
      const textarea = internalTextareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        const newHeight = Math.min(textarea.scrollHeight, maxHeight);
        textarea.style.height = `${newHeight}px`;
      }
    }, [value, maxHeight]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      adjustHeight();
      if (props.onChange) props.onChange(e);
    };

    const handleSubmit = async () => {
      // Allow submit for discover tool even without message
      if (selectedTool === 'discover') {
        const messageValue = ""; // Empty message for discover
        const tool = selectedTool;
        setValue("");
        setSelectedTool(null);
        adjustHeight(true);
        await onSubmit?.(messageValue, tool);
        return;
      }
      
      if (!value.trim() || submitted) return;
      const messageValue = value;
      const tool = selectedTool;
      setValue("");
      setSelectedTool(null);
      adjustHeight(true);
      await onSubmit?.(messageValue, tool);
    };

    const hasValue = value.trim().length > 0;
    // Handle genre and emotion selections - extract the base tool ID
    const baseToolId = selectedTool?.startsWith('genre-') ? 'genres'
      : selectedTool?.startsWith('emotion-') ? 'emotion'
        : selectedTool;
    const activeTool = baseToolId ? toolsList.find(t => t.id === baseToolId) : null;
    const ActiveToolIcon = activeTool?.icon;
    // Get the selected genre name if a genre is selected
    const selectedGenre = selectedTool?.startsWith('genre-')
      ? genresList.find(g => g.toLowerCase() === selectedTool.replace('genre-', ''))
      : null;
    // Get the selected emotion name if an emotion is selected
    const selectedEmotion = selectedTool?.startsWith('emotion-')
      ? emotionsData.find(e => e.emotion.toLowerCase() === selectedTool.replace('emotion-', ''))?.emotion
      : null;

    return (
      <div className={cn(
        "flex flex-col rounded-[28px] p-2 shadow-sm transition-colors",
        "bg-white/5 backdrop-blur-2xl border border-white/10",
        "cursor-text",
        className
      )}>
        <div className="relative">
          {/* Overlay for highlighting emotion terms - only show when there's text */}
          {value && (
            <div
              aria-hidden="true"
              className={cn(
                "absolute inset-0 w-full bg-transparent p-3 pointer-events-none",
                "whitespace-pre-wrap wrap-break-word overflow-hidden",
                "text-sm leading-normal font-sans text-white"
              )}
              style={{
                minHeight: '48px',
                wordBreak: 'break-word'
              }}
            >
              {renderHighlightedText(value)}
            </div>
          )}

          <textarea
            ref={internalTextareaRef}
            rows={1}
            value={value}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder=""
            disabled={submitted}
            className={cn(
              "relative z-10 w-full resize-none border-0 bg-transparent p-3",
              "placeholder:text-white/50 focus:ring-0 focus-visible:outline-none",
              "min-h-12 no-scrollbar",
              "text-sm leading-normal font-sans"
            )}
            style={{
              color: value ? 'transparent' : 'inherit',
              caretColor: 'white'
            }}
            {...props}
          />
          {!value && !submitted && (
            <div className="absolute inset-0 flex items-start pl-3 pr-10 pt-[14px] pointer-events-none">
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

        <div className="mt-0.5 p-1 pt-0">
          <TooltipProvider delayDuration={100}>
            <div className="flex items-center gap-2">
              {/* Tools popover */}
              <Popover open={isPopoverOpen} onOpenChange={(open) => {
                setIsPopoverOpen(open);
                if (!open) {
                  setShowEmotionSubmenu(false);
                  setShowGenresSubmenu(false);
                }
              }}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex h-8 items-center gap-2 rounded-full p-2 text-sm text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                      >
                        <Settings2 className="h-4 w-4" />
                        {!selectedTool && 'Tools'}
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" showArrow={true}>
                    <p>Explore Tools</p>
                  </TooltipContent>
                </Tooltip>
                <PopoverContent side="top" align="start" className="relative">
                  {!showEmotionSubmenu && !showGenresSubmenu ? (
                    <div className="flex flex-col gap-1">
                      {toolsList.map((tool) => {
                        const Icon = tool.icon;
                        return (
                          <button
                            key={tool.id}
                            onClick={async () => {
                              if (tool.id === 'emotion' && tool.hasSubmenu) {
                                setShowEmotionSubmenu(true);
                              } else if (tool.id === 'genres' && tool.hasSubmenu) {
                                setShowGenresSubmenu(true);
                              } else {
                                // Auto-submit for discover tool before closing popover
                                if (tool.id === 'discover') {
                                  setIsPopoverOpen(false);
                                  // Submit with discover tool and empty message
                                  setValue("");
                                  adjustHeight(true);
                                  await onSubmit?.("", tool.id);
                                } else {
                                  setSelectedTool(tool.id);
                                  setIsPopoverOpen(false);
                                }
                              }
                            }}
                            className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm text-white hover:bg-white/10 transition-colors"
                          >
                            <Icon className="h-4 w-4" />
                            <span>{tool.name}</span>
                            {tool.hasSubmenu && (
                              <ChevronRight className="h-4 w-4 ml-auto" />
                            )}
                            {tool.extra && (
                              <span className="ml-auto text-xs text-white/50">
                                {tool.extra}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : showEmotionSubmenu ? (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setShowEmotionSubmenu(false)}
                        className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-xs text-white hover:bg-white/10 transition-colors mb-1"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Back</span>
                      </button>
                      <div className="h-px bg-white/10 my-1" />
                      <div className="max-h-48 overflow-y-auto genres-scrollbar">
                        {emotionsData.length === 0 ? (
                          <div className="p-3 text-center">
                            <p className="text-[10px] text-white/40 mb-2">No custom emotions found.</p>
                            <p className="text-[10px] text-white/40">Add them in Personal settings.</p>
                          </div>
                        ) : (
                          emotionsData.map((e) => (
                            <button
                              key={e.emotion}
                              onClick={() => {
                                const toolValue = `emotion-${e.emotion.toLowerCase()}`;
                                console.log('🎭 [EMOTION DEBUG] Emotion clicked:', e.emotion);
                                console.log('  - toolValue:', toolValue);
                                console.log('  - emotionsData at click:', emotionsData);
                                setSelectedTool(toolValue);
                                setIsPopoverOpen(false);
                                setShowEmotionSubmenu(false);
                              }}
                              className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-xs text-white hover:bg-white/10 transition-colors"
                            >
                              <Heart className="h-3.5 w-3.5" />
                              <span>{e.emotion}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setShowGenresSubmenu(false)}
                        className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-xs text-white hover:bg-white/10 transition-colors mb-1"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Back</span>
                      </button>
                      <div className="h-px bg-white/10 my-1" />
                      <div className="max-h-48 overflow-y-auto genres-scrollbar">
                        {genresList.map((genre) => (
                          <button
                            key={genre}
                            onClick={() => {
                              setSelectedTool(`genre-${genre.toLowerCase()}`);
                              setShowGenresSubmenu(false);
                              setIsPopoverOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-xs text-white hover:bg-white/10 transition-colors"
                          >
                            <Music className="h-3.5 w-3.5" />
                            <span>{genre}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {activeTool && (
                <>
                  <div className="h-4 w-px bg-white/20" />
                  <button
                    onClick={() => setSelectedTool(null)}
                    className="flex h-8 items-center gap-2 rounded-full px-2 text-sm text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    {ActiveToolIcon && <ActiveToolIcon className="h-4 w-4" />}
                    {selectedEmotion ? `${activeTool.shortName}: ${selectedEmotion}`
                      : selectedGenre ? `${activeTool.shortName}: ${selectedGenre}`
                        : activeTool.shortName}
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}

              {/* Right-aligned buttons container */}
              <div className="ml-auto flex items-center gap-2">
                {/* Spotify Connect Button */}
                {!spotifyConnected && onSpotifyClick && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={onSpotifyClick}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1DB954] hover:bg-[#1ed760] transition-colors"
                        type="button"
                        title="Connect Spotify"
                      >
                        <svg
                          className="w-4 h-4 text-white"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.84-.179-.84-.66 0-.359.24-.66.54-.779 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.242 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
                        </svg>
                        <span className="sr-only">Connect Spotify</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" showArrow={true}>
                      <p>Connect Spotify</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Spotify Connected Indicator */}
                {spotifyConnected && (
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1DB954]/20 border border-[#1DB954]/30"
                    title="Spotify Connected"
                  >
                    <svg
                      className="w-4 h-4 text-[#1DB954]"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.84-.179-.84-.66 0-.359.24-.66.54-.779 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.242 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
                    </svg>
                  </div>
                )}

                {/* Send button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!hasValue || submitted}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                        submitted
                          ? "bg-white/10 border border-white/20 backdrop-blur-md"
                          : hasValue
                            ? "bg-white/10 border border-white/20 backdrop-blur-md hover:bg-white/20"
                            : "bg-white/5 border border-white/10 opacity-30 cursor-not-allowed"
                      )}
                    >
                      {submitted ? (
                        <Spinner size="sm" className="text-white/70" />
                      ) : (
                        <CornerRightUp className="h-4 w-4 text-white" />
                      )}
                      <span className="sr-only">Send message</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" showArrow={true}>
                    <p>Send</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>
        </div>
      </div>
    );
  }
);

ChatGPTPromptInput.displayName = "ChatGPTPromptInput";

