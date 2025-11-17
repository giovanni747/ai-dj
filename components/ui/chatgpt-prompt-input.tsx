"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { CornerRightUp, Settings2, X, Mic, Globe, Pencil, Sparkles, Lightbulb, Search } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useAutoResizeTextarea } from "@/components/hooks/use-auto-resize-textarea";
import { Typewriter } from "@/components/ui/typewriter";

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
        "relative z-50 max-w-[280px] rounded-md bg-popover text-popover-foreground px-1.5 py-1 text-xs animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    >
      {props.children}
      {showArrow && <TooltipPrimitive.Arrow className="-my-px fill-popover" />}
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
        "z-50 w-64 rounded-xl bg-white/10 backdrop-blur-2xl border border-white/20 p-2 text-white shadow-md outline-none animate-in data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

// Tools list for the popover
const toolsList = [
  { id: 'createImage', name: 'Create an image', shortName: 'Image', icon: Sparkles },
  { id: 'searchWeb', name: 'Search the web', shortName: 'Search', icon: Search },
  { id: 'writeCode', name: 'Write or code', shortName: 'Write', icon: Pencil },
  { id: 'deepResearch', name: 'Run deep research', shortName: 'Deep Search', icon: Globe, extra: '5 left' },
  { id: 'thinkLonger', name: 'Think for longer', shortName: 'Think', icon: Lightbulb },
];

interface ChatGPTPromptInputProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onSubmit'> {
  onSubmit?: (value: string) => void | Promise<void>;
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
      if (!value.trim() || submitted) return;
      const messageValue = value;
      setValue("");
      adjustHeight(true);
      await onSubmit?.(messageValue);
    };

    const hasValue = value.trim().length > 0;
    const activeTool = selectedTool ? toolsList.find(t => t.id === selectedTool) : null;
    const ActiveToolIcon = activeTool?.icon;

    return (
      <div className={cn(
        "flex flex-col rounded-[28px] p-2 shadow-sm transition-colors",
        "bg-white/5 backdrop-blur-2xl border border-white/10",
        "cursor-text",
        className
      )}>
        <div className="relative">
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
              "w-full resize-none border-0 bg-transparent p-3 text-white",
              "placeholder:text-white/50 focus:ring-0 focus-visible:outline-none",
              "min-h-12 custom-scrollbar"
            )}
            {...props}
          />
          {!value && !submitted && (
            <div className="absolute inset-0 flex items-center pl-3 pr-10 py-3 pointer-events-none">
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
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
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
                <PopoverContent side="top" align="start">
                  <div className="flex flex-col gap-1">
                    {toolsList.map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <button
                          key={tool.id}
                          onClick={() => {
                            setSelectedTool(tool.id);
                            setIsPopoverOpen(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm text-white hover:bg-white/10 transition-colors"
                        >
                          <Icon className="h-4 w-4" />
                          <span>{tool.name}</span>
                          {tool.extra && (
                            <span className="ml-auto text-xs text-white/50">
                              {tool.extra}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
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
                    {activeTool.shortName}
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

                {/* Mic button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-none"
                    >
                      <Mic className="h-5 w-5" />
                      <span className="sr-only">Record voice</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" showArrow={true}>
                    <p>Record voice</p>
                  </TooltipContent>
                </Tooltip>

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

