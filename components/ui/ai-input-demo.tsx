"use client";

import { AIInputWithLoading } from "@/components/ui/ai-input-with-loading";
import { ChatGPTPromptInput } from "@/components/ui/chatgpt-prompt-input";
import { useState, useEffect, Fragment, useRef } from "react";
import { motion } from "framer-motion";
import AILoadingState from "@/components/kokonutui/ai-loading";
import Loader from "@/components/kokonutui/loader";
import { TextAnimate } from "@/components/ui/text-animate";
import { TrackList } from "@/components/ui/track-list";
import { AnimatedTrackCarousel } from "@/components/ui/animated-track-carousel";
import type { DJRecommendation, SpotifyTrack } from "@/types";
import {
  ThumbsDownIcon,
  ThumbsUpIcon,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Action, Actions } from "@/components/ui/actions";
import {
  Conversation,
  ConversationContent,
} from "@/components/ui/conversation";
import { cn } from "@/lib/utils";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import dynamic from "next/dynamic";

const DynamicRiveAvatar = dynamic(
  () => import("./dj-rive-avatar").then((m) => m.DjRiveAvatar),
  { ssr: false }
);

interface Message {
  id: string;
  dbId?: number; // Database ID for saving feedback
  role: "user" | "assistant";
  content: string;
  tracks?: SpotifyTrack[];
  liked?: boolean;
  disliked?: boolean;
  switched?: boolean;
  likedTracks?: Set<string>;
}

interface AIInputWithLoadingDemoProps {
  spotifyConnected?: boolean;
  onSpotifyReconnect?: () => void;
}

// Avatar URL - using Unsplash image for LLM
const ASSISTANT_AVATAR = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=100&h=100&fit=crop";

export function AIInputWithLoadingDemo({ 
  spotifyConnected = false,
  onSpotifyReconnect 
}: AIInputWithLoadingDemoProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [frequentlyLikedTerms, setFrequentlyLikedTerms] = useState<Set<string>>(new Set());
  
  // Track if history has been loaded to prevent overwriting new messages
  const historyLoadedRef = useRef(false);
  const hasNewMessagesRef = useRef(false);
  
  // Ref for scroll container to prevent scrolling past top
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Load frequently liked terms
  const loadFrequentlyLikedTerms = async () => {
    try {
      const response = await fetch('/api/frequently-liked-terms?min_occurrences=2', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        const termsSet = new Set<string>(data.terms || []);
        setFrequentlyLikedTerms(termsSet);
        console.log(`✅ Loaded ${termsSet.size} frequently liked terms`);
      } else {
        console.error('Failed to load frequently liked terms');
      }
    } catch (error) {
      console.error('Error loading frequently liked terms:', error);
    }
  };

  // Generate unique ID for messages
  const generateMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Handle feedback actions
  const handleLike = async (messageId: string) => {
    const message = messages.find(msg => msg.id === messageId);
    if (!message || !message.dbId) {
      console.error('Message not found or no database ID');
      return;
    }

    // Optimistic update
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, liked: true, disliked: false }
        : msg
    ));

    // Save to backend
    try {
      const response = await fetch('/api/message-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message_id: message.dbId,
          feedback_type: 'like',
        }),
      });

      if (!response.ok) {
        console.error('Failed to save message feedback');
        // Revert on error
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, liked: false }
            : msg
        ));
      }
    } catch (error) {
      console.error('Error saving message feedback:', error);
    }
  };

  const handleDislike = async (messageId: string) => {
    const message = messages.find(msg => msg.id === messageId);
    if (!message || !message.dbId) {
      console.error('Message not found or no database ID');
      return;
    }

    // Optimistic update
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, liked: false, disliked: true }
        : msg
    ));

    // Save to backend
    try {
      const response = await fetch('/api/message-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message_id: message.dbId,
          feedback_type: 'dislike',
        }),
      });

      if (!response.ok) {
        console.error('Failed to save message feedback');
        // Revert on error
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, disliked: false }
            : msg
        ));
      }
    } catch (error) {
      console.error('Error saving message feedback:', error);
    }
  };

  const handleSwitch = (messageId: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, switched: !msg.switched }
        : msg
    ));
  };

  const handleToggleTrackLike = async (messageId: string, trackId: string) => {
    // Find the track details
    const message = messages.find(msg => msg.id === messageId);
    const track = message?.tracks?.find(t => t.id === trackId);
    
    if (!track) {
      console.error('Track not found');
      return;
    }
    
    const isCurrentlyLiked = message?.likedTracks?.has(trackId) || false;
    
    // Optimistically update UI
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const likedTracks = msg.likedTracks || new Set<string>();
        const newLikedTracks = new Set(likedTracks);
        
        if (newLikedTracks.has(trackId)) {
          newLikedTracks.delete(trackId);
        } else {
          newLikedTracks.add(trackId);
        }
        
        return { ...msg, likedTracks: newLikedTracks };
      }
      return msg;
    }));
    
    // Save to backend
    try {
      const imageUrl = track.album?.images?.[0]?.url || null;
      const highlightedTerms = track.highlighted_terms || [];
      
      const response = await fetch('/api/track-like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          track_id: trackId,
          track_name: track.name,
          track_artist: track.artist,
          track_image_url: imageUrl,
          highlighted_terms: isCurrentlyLiked ? undefined : highlightedTerms, // Only send when liking
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to save track like');
        // Revert UI on error
        setMessages(prev => prev.map(msg => {
          if (msg.id === messageId) {
            const likedTracks = msg.likedTracks || new Set<string>();
            const newLikedTracks = new Set(likedTracks);
            
            if (newLikedTracks.has(trackId)) {
              newLikedTracks.delete(trackId);
            } else {
              newLikedTracks.add(trackId);
            }
            
            return { ...msg, likedTracks: newLikedTracks };
          }
          return msg;
        }));
      } else {
        const data = await response.json();
        console.log('Track like saved:', data);
        
        // Refresh frequently liked terms after liking/unliking
        if (data.liked !== undefined) {
          loadFrequentlyLikedTerms();
        }
      }
    } catch (error) {
      console.error('Error saving track like:', error);
    }
  };


  // Debug: Monitor messages state changes
  useEffect(() => {
    console.log('🔄 Messages state changed:', {
      count: messages.length,
      messages: messages.map(m => ({ 
        id: m.id, 
        role: m.role, 
        hasContent: !!m.content,
        hasTracks: !!m.tracks,
        trackCount: m.tracks?.length 
      }))
    });
  }, [messages]);

  // Load chat history and liked tracks on mount
  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const loadHistory = async () => {
      try {
        // Check if user has already interacted - if so, abort immediately
        if (hasNewMessagesRef.current || historyLoadedRef.current) {
          console.log('⏭️ SKIP: User has already interacted or history loaded - aborting history load');
          abortController.abort();
          return;
        }
        
        if (!isMounted) return;
        setIsLoadingHistory(true);

        // Load chat history (Clerk auth is handled by the API route)
        const historyResponse = await fetch('/api/chat-history?limit=50', {
          credentials: 'include',
          signal: abortController.signal,
        });

        // Check again before processing response
        if (hasNewMessagesRef.current || historyLoadedRef.current) {
          console.log('⏭️ SKIP: User interacted during history load - aborting');
          abortController.abort();
          return;
        }

        if (!isMounted) return;

        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          const loadedMessages: Message[] = [];

          if (historyData.messages && historyData.messages.length > 0) {
            // Convert database messages to UI messages
            for (const dbMsg of historyData.messages) {
              loadedMessages.push({
                id: `db-${dbMsg.id}`,
                dbId: dbMsg.id,
                role: dbMsg.role,
                content: dbMsg.content,
                tracks: dbMsg.tracks || undefined,
                likedTracks: new Set<string>(),
              });
            }
          }

          // Load liked tracks
          const likedTracksResponse = await fetch('/api/liked-tracks', {
            credentials: 'include',
            signal: abortController.signal,
          });

          // Check again before processing liked tracks
          if (hasNewMessagesRef.current || historyLoadedRef.current) {
            console.log('⏭️ SKIP: User interacted during liked tracks load - aborting');
            abortController.abort();
            return;
          }

          if (!isMounted) return;

          if (likedTracksResponse.ok) {
            const likedData = await likedTracksResponse.json();
            const likedTrackIds = new Set(likedData.track_ids || []);

            // Update messages with liked track state
            loadedMessages.forEach(msg => {
              if (msg.tracks) {
                const msgLikedTracks = new Set<string>();
                msg.tracks.forEach(track => {
                  if (likedTrackIds.has(track.id)) {
                    msgLikedTracks.add(track.id);
                  }
                });
                msg.likedTracks = msgLikedTracks;
              }
            });
          }

          // Final check before setting state
          if (hasNewMessagesRef.current || historyLoadedRef.current) {
            console.log('⏭️ SKIP: User interacted before setting history - preserving current state');
            return;
          }

          if (isMounted) {
            // Only set messages if we're in the initial load (empty state)
            // Don't overwrite messages that are already in state or if we have new messages
            setMessages(prev => {
              // CRITICAL: Check refs and current state
              const hasNewMessages = hasNewMessagesRef.current;
              const historyAlreadyLoaded = historyLoadedRef.current;
              
              console.log('📋 History loading - final check before setting:', {
                prevLength: prev.length,
                loadedLength: loadedMessages.length,
                hasNewMessages,
                historyAlreadyLoaded,
                isMounted
              });
              
              // NEVER overwrite if we have new messages (user has interacted)
              if (hasNewMessages) {
                console.log('⏭️ SKIP: Has new messages - preserving current messages');
                return prev;
              }
              
              // NEVER overwrite if history was already loaded
              if (historyAlreadyLoaded) {
                console.log('⏭️ SKIP: History already loaded - preserving current messages');
                return prev;
              }
              
              // NEVER overwrite if messages already exist (user has added messages)
              if (prev.length > 0) {
                console.log('⏭️ SKIP: Messages already exist in state:', prev.length, '- preserving them');
                historyLoadedRef.current = true;
                return prev;
              }
              
              // ONLY load history if messages array is empty (initial load)
              console.log('📥 LOADING: Initial history load:', loadedMessages.length, 'messages');
              historyLoadedRef.current = true;
              return loadedMessages;
            });
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('🛑 History load aborted (user interaction detected)');
        } else {
          console.error('Error loading chat history:', error);
        }
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    };

    loadHistory();

    // Cleanup function - also abort if user interacts
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  // Load frequently liked terms after history is loaded
  useEffect(() => {
    if (!isLoadingHistory) {
      // Load after a short delay to ensure likes are saved
      const timer = setTimeout(() => {
        loadFrequentlyLikedTerms();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoadingHistory]);

  // Compute hasMessages (used in multiple places)
  const hasMessages = messages.length > 0 || isSubmitting;

  // Prevent scrolling past the top (like ChatGPT)
  // MUST be before any early returns to maintain hook order
  useEffect(() => {
    if (!hasMessages) return;
    
    // Find the actual scrollable element (StickToBottom creates a wrapper)
    const findScrollContainer = () => {
      if (scrollContainerRef.current) {
        // Try to find the scrollable div inside StickToBottom
        const scrollable = scrollContainerRef.current.querySelector('[role="log"]') as HTMLElement;
        return scrollable || scrollContainerRef.current;
      }
      return null;
    };

    const scrollContainer = findScrollContainer();
    if (!scrollContainer) return;

    let lastScrollTop = scrollContainer.scrollTop;

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const currentScrollTop = target.scrollTop;
      
      // If scrolling up and at the top, prevent further scrolling
      if (currentScrollTop <= 0 && lastScrollTop <= 0) {
        // Prevent overscroll at top
        if (target.scrollTop < 0) {
          target.scrollTop = 0;
        }
      }
      
      lastScrollTop = currentScrollTop;
    };

    // Handle wheel events to prevent overscroll
    const handleWheel = (e: WheelEvent) => {
      const target = scrollContainer;
      if (!target) return;

      // If at top and scrolling up, prevent default
      if (target.scrollTop <= 0 && e.deltaY < 0) {
        e.preventDefault();
        target.scrollTop = 0;
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    scrollContainer.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      scrollContainer.removeEventListener('wheel', handleWheel);
    };
  }, [hasMessages]);

  const simulateResponse = async (message: string) => {
    setIsSubmitting(true);
    
    // Spotify authentication is required - user must be authenticated to use the app
    
    try {
      // Call the Next.js API route which forwards to Flask backend
      const response = await fetch('/api/dj-recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ message }),
      });

      if (response.ok) {
        const data: DJRecommendation = await response.json();
        
        // Debug: Log the response
        console.log('DJ Recommendation Response:', data);
        console.log('Tracks received:', data.tracks?.length || 0);
        
        // Debug: Check preview URLs
        if (data.tracks && data.tracks.length > 0) {
          const tracksWithPreview = data.tracks.filter((t: SpotifyTrack) => t.preview_url);
          const tracksWithoutPreview = data.tracks.filter((t: SpotifyTrack) => !t.preview_url);
          console.log(`Preview URLs available: ${tracksWithPreview.length}/${data.tracks.length}`);
          if (tracksWithoutPreview.length > 0) {
            console.log('Tracks without preview:', tracksWithoutPreview.map((t: SpotifyTrack) => t.name));
          }
          
          // Debug: Log lyrics and explanations
          const tracksWithLyrics = data.tracks.filter((t: SpotifyTrack) => t.lyrics);
          const tracksWithExplanations = data.tracks.filter((t: SpotifyTrack) => t.lyrics_explanation);
          console.log(`📝 Lyrics available: ${tracksWithLyrics.length}/${data.tracks.length}`);
          console.log(`💡 Explanations available: ${tracksWithExplanations.length}/${data.tracks.length}`);
        }
        
        // Add user message
        const userMessage: Message = { 
          id: generateMessageId(),
          dbId: data.user_message_db_id || undefined,
          role: "user", 
          content: message 
        };
        
        // Add assistant response with tracks
        const assistantMessage: Message = {
          id: generateMessageId(),
          dbId: data.assistant_message_db_id || undefined,
          role: "assistant",
          content: data.dj_response || "I'm ready to help you discover music!",
          tracks: data.tracks || [],
          likedTracks: new Set<string>(),
        };
        
        // Add both messages in a single state update
        hasNewMessagesRef.current = true;
        historyLoadedRef.current = true;
        setMessages(prev => [...prev, userMessage, assistantMessage]);
      } else {
        // Handle error with details from backend if available
        let errorText = "Sorry, I couldn't process your request. Please try again.";
        try {
          const errJson = await response.json();
          if (errJson?.error) errorText = typeof errJson.error === 'string' ? errJson.error : JSON.stringify(errJson.error);
        } catch {}
        
        const userMessage: Message = { 
          id: generateMessageId(),
          role: "user", 
          content: message 
        };
        const errorMessage: Message = { 
          id: generateMessageId(),
          role: "assistant", 
          content: errorText 
        };
        hasNewMessagesRef.current = true;
        historyLoadedRef.current = true;
        setMessages(prev => [...prev, userMessage, errorMessage]);
      }
    } catch (error) {
      console.error('Error submitting message:', error);
      const userMessage: Message = { 
        id: generateMessageId(),
        role: "user", 
        content: message 
      };
      const errorMessage: Message = {
        id: generateMessageId(),
        role: "assistant",
        content: "Sorry, I'm having trouble connecting. Please make sure the backend is running."
      };
      hasNewMessagesRef.current = true;
      historyLoadedRef.current = true;
      setMessages(prev => [...prev, userMessage, errorMessage]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading indicator while loading history
  // This early return is AFTER all hooks to maintain hook order
  if (isLoadingHistory) {
    return (
      <div className="flex flex-col h-screen items-center justify-center">
        <Loader 
          title="Loading chat history..." 
          subtitle="Please wait"
          size="md"
          className="text-white"
        />
      </div>
    );
  }

  // Handle Spotify connect button click
  const handleSpotifyConnect = () => {
    window.location.href = 'http://127.0.0.1:5001/';
  };

  return (
    <div className="relative flex flex-col h-screen min-w-[350px] sm:min-w-[500px] md:min-w-[710px] w-full overflow-hidden">
      {/* Top-left Rive DJ avatar */}
      <div className="fixed top-5 md:left-[calc((100%-60rem)/2+1rem)] z-20 flex flex-col items-center gap-2">
        <DynamicRiveAvatar
          size={400}
          src="/dj_avatar.riv"
          stateMachine="State Machine 1"
        />
      </div>
      {/* Messages container - using Conversation component - fills remaining space */}
      <Conversation
        ref={scrollContainerRef}
        className={cn(
          "flex-1 no-scrollbar overflow-y-auto relative",
          !hasMessages && "flex items-center justify-center"
        )}
        style={{ 
          overscrollBehavior: 'none', // Prevent overscroll bounce
          scrollBehavior: 'smooth'
        }}
      >
        {/* Progressive blur at top to prevent messages from reaching viewport edge */}
        {hasMessages && (
          <ProgressiveBlur 
            position="top" 
            backgroundColor="rgb(0, 0, 0)"
            height="90px"
            blurAmount="8px"
          />
        )}
        <ConversationContent className={hasMessages ? "px-4 pt-[420px] pb-6" : "p-4 pt-[420px]"}>
          <div className={cn(
            "max-w-3xl w-full mx-auto flex flex-col",
            (messages.length === 0 && !isSubmitting) ? "items-center justify-center" : ""
          )}>
            {messages.length === 0 && !isSubmitting && (
              <div className="text-center text-gray-400 text-sm">
                Start a conversation with your AI DJ
              </div>
            )}
            
            {(() => {
              console.log('🎨 Rendering messages:', { 
                count: messages.length, 
                isSubmitting,
                messages: messages.map(m => ({ 
                  id: m.id, 
                  role: m.role, 
                  hasContent: !!m.content,
                  hasTracks: !!m.tracks,
                  trackCount: m.tracks?.length 
                }))
              });
              return null;
            })()}
            
            {messages.map((msg, index) => {
              // Determine if we're currently processing (waiting for AI response)
              const isLastMessage = index === messages.length - 1;
              const isProcessingLastUserMessage = isSubmitting && msg.role === "user" && isLastMessage;
              
              // Fade previous messages when processing (but don't hide them)
              const shouldFadePrevious = isSubmitting && !isLastMessage;
              
              // Show assistant messages with content (intro text)
              if (msg.role === "assistant" && msg.content && (!msg.tracks || msg.tracks.length === 0)) {
              return (
                <motion.div
                  key={msg.id}
                  data-message-id={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                    className="w-full flex gap-2 py-4 justify-start"
                  >
                    <div className="flex flex-col gap-2 items-start max-w-[85%]">
                <div className={cn(
                        "px-4 py-3 rounded-2xl break-word",
                        "bg-white/5 text-white backdrop-blur-md border border-white/10 text-sm"
                      )}>
                        <TextAnimate 
                          animation="fadeIn" 
                          by="line"
                          startOnView={false}
                          once={true}
                          className="text-white"
                        >
                          {msg.content}
                        </TextAnimate>
                      </div>
                    </div>
                  </motion.div>
                );
              }
              
              // Show assistant messages with tracks
              if (msg.role === "assistant" && msg.tracks && msg.tracks.length > 0) {
                return (
                  <Fragment key={msg.id}>
                    {/* Show intro content if it exists */}
                    {msg.content && (
                      <motion.div
                        data-message-id={`${msg.id}-content`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="w-full flex gap-2 py-4 justify-start"
                      >
                        <div className="flex flex-col gap-2 items-start max-w-[85%]">
                  <div className={cn(
                    "px-4 py-3 rounded-2xl break-word",
                            "bg-white/5 text-white backdrop-blur-md border border-white/10 text-sm"
                  )}>
                    <TextAnimate 
                      animation="fadeIn" 
                      by="line"
                      startOnView={false}
                      once={true}
                      className="text-white"
                    >
                      {msg.content}
                    </TextAnimate>
                  </div>
                        </div>
                      </motion.div>
                    )}
                    
                    {/* Show tracks */}
                    <motion.div
                      key={`${msg.id}-tracks`}
                      data-message-id={`${msg.id}-tracks`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                      className="w-full flex gap-2 py-4 justify-start"
                    >
                      <div className="flex flex-col gap-2 items-start max-w-[85%] w-full">
                        {/* Display tracks - with glass div styling */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.2 }}
                      className={cn(
                        "w-full rounded-2xl p-4",
                        msg.switched 
                          ? "bg-transparent" 
                          : "bg-white/5 backdrop-blur-md border border-white/10"
                      )}
                    >
                      {!msg.switched && (
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-white">
                            🎵 Your Playlist ({msg.tracks.length} tracks)
                          </h3>
                        </div>
                      )}
                      {msg.switched ? (
                        <AnimatedTrackCarousel tracks={msg.tracks} />
                      ) : (
                        <TrackList 
                          tracks={msg.tracks} 
                          likedTracks={msg.likedTracks || new Set()}
                          onToggleLike={(trackId) => handleToggleTrackLike(msg.id, trackId)}
                              frequentlyLikedTerms={frequentlyLikedTerms}
                        />
                      )}
                    </motion.div>
                  
                  {/* Action buttons for assistant messages - like, dislike, and switch */}
                    <Actions className={cn("mt-2", msg.switched && "mt-1")}>
                      <Action
                        label="Like"
                        tooltip="Like this response"
                        onClick={() => handleLike(msg.id)}
                        className={msg.liked ? "text-green-500" : ""}
                      >
                        <ThumbsUpIcon className="size-4" />
                      </Action>
                      <Action
                        label="Dislike"
                        tooltip="Dislike this response"
                        onClick={() => handleDislike(msg.id)}
                        className={msg.disliked ? "text-red-500" : ""}
                      >
                        <ThumbsDownIcon className="size-4" />
                      </Action>
                      <Action
                        label="Switch"
                        tooltip="Switch"
                        onClick={() => handleSwitch(msg.id)}
                        className={msg.switched ? "text-blue-500" : ""}
                      >
                        {msg.switched ? (
                          <ToggleRight className="size-4" />
                        ) : (
                          <ToggleLeft className="size-4" />
                        )}
                      </Action>
                    </Actions>
                      </div>
                    </motion.div>
                  </Fragment>
                );
              }
              
              // Show user messages in chat (aligned to top right like ChatGPT)
              if (msg.role === "user") {
                return (
                  <motion.div
                    key={msg.id}
                    data-message-id={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ 
                      opacity: shouldFadePrevious ? 0.5 : 1, 
                      y: 0,
                      scale: isProcessingLastUserMessage ? 1.02 : 1
                    }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "w-full flex gap-2 py-4 justify-end items-start",
                      isProcessingLastUserMessage && "z-10 relative"
                    )}
                  >
                    <div className="flex flex-col gap-2 items-end max-w-[75%]">
                      <div className={cn(
                        "px-4 py-3 rounded-2xl break-word",
                        "bg-white/5 text-white backdrop-blur-md border border-white/10 text-sm"
                      )}>
                        <TextAnimate 
                          animation="fadeIn" 
                          by="line"
                          startOnView={false}
                          once={true}
                          className="text-white"
                        >
                          {msg.content}
                        </TextAnimate>
                      </div>
                </div>
              </motion.div>
              );
              }
              
              return null;
            })}
            
            {isSubmitting && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-start"
              >
                <div>
                  <AILoadingState />
                </div>
              </motion.div>
            )}
          </div>
        </ConversationContent>
      </Conversation>
      
      {/* Input - at bottom of flex container, centered when no messages */}
      {/* Messages are clipped below this input area */}
      <div className={cn(
        "w-full shrink-0 relative z-30",
        !hasMessages && "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      )}>
        <div
          className={cn(
            "w-full mx-auto relative z-20",
            hasMessages 
              ? "max-w-4xl px-4 py-6" 
              : "max-w-4xl px-4 pt-6 pb-4 pointer-events-auto"
          )}
        >
          <ChatGPTPromptInput 
            onSubmit={simulateResponse}
            loadingDuration={3000}
            submitted={isSubmitting}
            spotifyConnected={spotifyConnected}
            onSpotifyClick={handleSpotifyConnect}
            minHeight={56}
            maxHeight={200}
          />
        </div>
      </div>
    </div>
  );
}

