"use client";

import { ChatGPTPromptInput } from "@/components/ui/chatgpt-prompt-input";
import { useState, useEffect, Fragment, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  X, Volume2, VolumeX,
  Music, Play, Radio, User, FileText, Calendar, MessageSquare, MoreHorizontal, CheckCircle
} from "lucide-react";
import { useTextToSpeech } from "@/components/hooks/use-text-to-speech";
import { Action, Actions } from "@/components/ui/actions";
import {
  Conversation,
  ConversationContent,
} from "@/components/ui/conversation";
import { cn } from "@/lib/utils";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import dynamic from "next/dynamic";
import { WebGLShader } from "@/components/ui/web-gl-shader";
import { useUser } from "@clerk/nextjs";
import { ImageCarouselHero, type ImageCard } from "@/components/ui/image-carousel-hero";

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

// Scenarios data
const scenarios = [
  { title: "Late Night Drive", description: "City lights and chill beats" },
  { title: "Workout Mode", description: "High energy pumping tracks" },
  { title: "Sunset Vibes", description: "Golden hour melodies" },
  { title: "Focus & Study", description: "Lo-fi beats for concentration" },
  { title: "Party Mix", description: "Upbeat dance floor fillers" },
];

export function AIInputWithLoadingDemo({
  spotifyConnected = false
}: AIInputWithLoadingDemoProps) {
  const { isSignedIn } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [frequentlyLikedTerms, setFrequentlyLikedTerms] = useState<Set<string>>(new Set());
  const [heroImages, setHeroImages] = useState<ImageCard[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Manage bubble visibility
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  // Manage bubble visibility and expansion
  const [isBubbleExpanded, setIsBubbleExpanded] = useState(false);

  // Track if history has been loaded to prevent overwriting new messages
  const historyLoadedRef = useRef(false);
  const hasNewMessagesRef = useRef(false);

  // Ref for scroll container to prevent scrolling past top
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Load frequently liked terms (only when signed in)
  const loadFrequentlyLikedTerms = useCallback(async () => {
    // Only load if user is signed in
    if (!isSignedIn) {
      return;
    }

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
        // Silently fail if not authenticated (401/403) - don't log as error
        if (response.status === 401 || response.status === 403) {
          return;
        }
        console.error('Failed to load frequently liked terms');
      }
    } catch (error) {
      // Silently fail if network error - don't log as error for unauthenticated users
      if (!isSignedIn) {
        return;
      }
      console.error('Error loading frequently liked terms:', error);
    }
  }, [isSignedIn]);

  // Load user profile for hero images
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!spotifyConnected) return;
      
      try {
        const response = await fetch('/api/get-user-profile', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.top_artists) {
            const images: ImageCard[] = data.top_artists
              .filter((artist: any) => artist.images && artist.images.length > 0)
              .map((artist: any, index: number) => ({
                id: `artist-${index}`,
                src: artist.images[0].url,
                alt: artist.name,
                rotation: (index * 10) - 10 // Slight rotation variation
              }))
              .slice(0, 6); // Take top 6
            
            if (images.length > 0) {
              setHeroImages(images);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, [spotifyConnected]);

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

  // Load chat history and liked tracks on mount (only when signed in)
  useEffect(() => {
    // Skip loading history if user is not signed in
    if (!isSignedIn) {
      setIsLoadingHistory(false);
      return;
    }

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
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
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
  }, [isSignedIn]);

  // Load frequently liked terms after history is loaded (only when signed in)
  useEffect(() => {
    if (!isLoadingHistory && isSignedIn) {
      // Load after a short delay to ensure likes are saved
      const timer = setTimeout(() => {
        loadFrequentlyLikedTerms();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoadingHistory, isSignedIn, loadFrequentlyLikedTerms]);

  // Find the latest assistant message to display in the speech bubble
  // Use useMemo to prevent unnecessary recalculations and flashing
  const latestAssistantMessage = useMemo(() => {
    if (messages.length === 0) return null;
    const latest = [...messages].reverse().find(m => m.role === "assistant" && m.content);
    return latest || null;
  }, [messages]);

  // Text-to-Speech Hook
  const { speak, cancel, isMuted, toggleMute, isSpeaking } = useTextToSpeech();

  // Manage bubble visibility effect
  // Only update when the message ID actually changes to prevent flashing
  useEffect(() => {
    const messageId = latestAssistantMessage?.id;
    const messageContent = latestAssistantMessage?.content?.trim();
    
    // If we have a new message (different ID)
    if (messageId && messageId !== lastMessageId) {
      setLastMessageId(messageId);
      setBubbleVisible(true);
      setIsBubbleExpanded(false); // Reset to dot for new message

      // Speak the message only if we have content
      if (messageContent) {
        speak(messageContent);
      }

      const timer = setTimeout(() => {
        setBubbleVisible(false);
      }, 30000);

      return () => clearTimeout(timer);
    } 
    // If message was removed (no latest message)
    else if (!latestAssistantMessage && lastMessageId) {
      setBubbleVisible(false);
      setLastMessageId(null);
      cancel();
    }
    // If we have the same message ID, don't do anything (prevent flashing)
    // The bubble should already be visible from the previous render
  }, [latestAssistantMessage?.id, lastMessageId, speak, cancel]);

  // Compute hasMessages (used in multiple places)
  const hasMessages = messages.length > 0 || isSubmitting;


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
        } catch { }

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
    <div className="flex h-screen w-full bg-black text-white overflow-hidden font-sans p-2 gap-2">
      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <div className="hidden md:flex w-80 flex-col gap-2 h-full shrink-0">
        
        {/* Scenarios Container */}
        <div className="flex-1 flex flex-col bg-[#0F0F0F] rounded-3xl border border-white/5 p-4 overflow-hidden">
          {/* Header / Scenarios Title */}
          <div className="flex items-center justify-between px-2 py-2 mb-2">
            <h2 className="text-xs font-medium text-gray-400 tracking-wider">SCENARIOS</h2>
          </div>

          {/* Scenarios List */}
          <div className="flex-1 flex flex-col gap-1 overflow-y-auto pr-2 no-scrollbar">
            {scenarios.map((scenario, i) => (
              <button 
                key={i}
                onClick={() => simulateResponse(`Create a playlist for ${scenario.title}`)}
                className="flex flex-col items-start p-3 rounded-xl transition-colors text-left hover:bg-[#1F1F1F] group"
              >
                <span className="text-white font-medium mb-0.5 text-sm group-hover:text-white/90">{scenario.title}</span>
                <span className="text-xs text-gray-500 group-hover:text-gray-400">{scenario.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Avatar Card at Bottom */}
        <div className="relative h-[300px] shrink-0 bg-[#F3E2A0] rounded-[32px] p-4 flex flex-col items-center justify-center shadow-xl overflow-visible group">
          {/* Mute Toggle Button - Absolute Top Right of Card */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className={cn(
              "absolute top-4 right-4 p-2 rounded-full bg-black/5 hover:bg-black/10 text-black transition-all z-40",
              isMuted ? "opacity-50" : "opacity-100"
            )}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <div className="text-black/40 text-[10px] font-bold tracking-widest absolute top-4 left-4">AI DJ</div>
          
          {/* Avatar Container - Centered & No Glass Background */}
          <div className="w-full flex justify-center items-center z-10">
            <div className="w-[280px] h-[240px]">
              <DynamicRiveAvatar
                size={440}
                src="/dj_avatar.riv"
                stateMachine="State Machine 1"
                isTyping={isTyping}
                className="bg-transparent border-none backdrop-blur-none"
                containerSize={280}
              />
                  </div>
                  </div>
      </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 relative flex flex-col h-full bg-[#0F0F0F] rounded-3xl overflow-hidden shadow-2xl border border-white/5">
        <WebGLShader className="absolute inset-0 w-full h-full pointer-events-none" />
        
      {/* Messages container - using Conversation component - fills remaining space */}
      <Conversation
        ref={scrollContainerRef}
          className="absolute inset-0 no-scrollbar overflow-y-auto z-0 snap-y snap-mandatory"
        style={{
          overscrollBehavior: 'none', // Prevent overscroll bounce
          scrollBehavior: 'smooth',
            scrollPaddingTop: '100px'
        }}
      >
        {/* Progressive blur at top to prevent messages from reaching viewport edge */}
        {hasMessages && (
          <ProgressiveBlur
            position="top"
              backgroundColor="rgb(15, 15, 15)"
              height="80px"
              blurAmount="12px"
          />
        )}
          <ConversationContent className={hasMessages ? "pt-20 pb-40" : "pt-[10vh] pb-20 flex flex-col justify-start min-h-full"}>
          <div className={cn(
              "max-w-4xl w-full mx-auto flex flex-col gap-8 px-4 md:px-12",
            (messages.length === 0 && !isSubmitting) ? "items-center justify-center" : ""
          )}>
            {messages.length === 0 && !isSubmitting && (
                <div className="w-full flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-700 origin-center">
                  {/* Header */}
                  <div className="text-center space-y-3 mt-0">
                    <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                      Hi, there <span className="animate-wave inline-block">👋</span>
                    </h1>
                    <p className="text-base text-white/60 max-w-md mx-auto">
                      Tell me what you want to hear, and I&apos;ll handle the mix.
                    </p>
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
                    {/* Card 1: Dark Accent */}
                    <div className="group relative p-6 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-md hover:bg-black/60 transition-all cursor-pointer overflow-hidden">
                      <div className="absolute top-0 right-0 p-4">
                        <span className="px-3 py-1 rounded-full bg-blue-500 text-[10px] font-semibold text-white">Beta</span>
                      </div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
                          <User size={16} />
                        </div>
                        <span className="text-sm font-medium text-white">AI DJ</span>
                      </div>
                      <p className="text-white/80 text-sm leading-relaxed mb-4">
                        Designed to analyze your mood and curate the perfect playlist for any moment.
                      </p>
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-linear-to-r from-blue-500 to-purple-500 opacity-50" />
                    </div>

                    {/* Card 2: List */}
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all cursor-pointer">
                      <div className="space-y-4">
                        <button 
                          onClick={() => simulateResponse("Create a workout mix")}
                          className="flex w-full items-center gap-3 text-sm text-white/80 hover:text-white transition-colors text-left"
                        >
                          <FileText size={16} className="text-blue-400 shrink-0" />
                          <span>Create a workout mix</span>
                        </button>
                        <button 
                          onClick={() => simulateResponse("Help me discover new artists")}
                          className="flex w-full items-center gap-3 text-sm text-white/80 hover:text-white transition-colors text-left"
                        >
                          <Radio size={16} className="text-purple-400 shrink-0" />
                          <span>Discover new artists</span>
                        </button>
                        <button 
                          onClick={() => simulateResponse("Explain the lyrics of the current song")}
                          className="flex w-full items-center gap-3 text-sm text-white/80 hover:text-white transition-colors text-left"
                        >
                          <MessageSquare size={16} className="text-green-400 shrink-0" />
                          <span>Explain these lyrics</span>
                        </button>
                      </div>
                      <div className="mt-6 flex justify-between items-center">
                        <span className="text-xs text-white/40">Suggested Actions</span>
                        <span className="text-xs text-blue-400 hover:underline">View All</span>
                      </div>
                    </div>

                    {/* Card 3: Prompt */}
                    <button 
                      onClick={() => simulateResponse("Play some upbeat pop for a road trip with friends")}
                      className="relative p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all cursor-pointer group text-left w-full"
                    >
                      <div className="absolute top-4 right-4">
                        <MoreHorizontal size={16} className="text-white/40" />
                      </div>
                      <h3 className="text-sm font-medium text-white mb-2">Try this prompt</h3>
                      <p className="text-lg font-medium text-white/90 leading-snug mb-4 group-hover:text-blue-300 transition-colors">
                        &quot;Play some upbeat pop for a road trip with friends&quot;
                      </p>
                      <div className="text-xs text-white/40">Click to send</div>
                    </button>
                  </div>

                  {/* Pill Buttons */}
                  <div className="flex flex-wrap justify-center gap-3 w-full mt-4">
                    {[
                      { icon: Calendar, label: "Recent Mixes", action: () => simulateResponse("Show my recent mixes") },
                      { icon: Play, label: "Start Radio", action: () => simulateResponse("Start a radio station based on my taste") },
                      { icon: CheckCircle, label: "Connect Spotify", action: handleSpotifyConnect },
                      { icon: Music, label: "Browse Genres", action: () => simulateResponse("Browse music genres") }
                    ].map((item, i) => (
                      <button 
                        key={i}
                        onClick={item.action}
                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:scale-105 transition-all text-sm text-white/80 hover:text-white backdrop-blur-md"
                      >
                        <item.icon size={14} className="opacity-70" />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
              </div>
            )}

            {(() => {
              console.log('🎨 Rendering messages:', {
                count: messages.length,
                isSubmitting
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
              // Always show the content in the chat, not hidden for bubble
              const isLatestAssistantMessage = msg.id === latestAssistantMessage?.id;

              if (msg.role === "assistant" && msg.content && (!msg.tracks || msg.tracks.length === 0)) {
                return (
                  <motion.div
                    key={msg.id}
                    data-message-id={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-full flex gap-4 py-4 justify-start snap-start"
                  >
                    <div className="flex flex-col gap-2 items-start max-w-[85%]">
                      <div className={cn(
                        "px-5 py-4 rounded-2xl rounded-tl-none break-word",
                        "bg-white/5 backdrop-blur-md border border-white/10 text-white text-sm shadow-md leading-relaxed"
                      )}>
                        <TextAnimate
                          animation="fadeIn"
                          by="line"
                          startOnView={false}
                          once={true}
                          className="text-white/90"
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
                        className="w-full flex gap-4 py-4 justify-start snap-start"
                      >
                        <div className="flex flex-col gap-2 items-start max-w-[85%]">
                          <div className={cn(
                            "px-5 py-4 rounded-2xl rounded-tl-none break-word",
                            "bg-white/5 backdrop-blur-md border border-white/10 text-white text-sm shadow-md leading-relaxed"
                          )}>
                            <TextAnimate
                              animation="fadeIn"
                              by="line"
                              startOnView={false}
                              once={true}
                              className="text-white/90"
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
                      className="w-full flex gap-4 py-2 justify-start snap-start pl-1"
                    >
                      <div className="flex flex-col gap-2 items-start max-w-[90%] w-full">
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
                              <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                                🎵 Your Playlist <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/60">{msg.tracks.length}</span>
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
                            tooltip="Switch View"
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
                      "w-full flex gap-2 py-4 justify-end items-start snap-start",
                      isProcessingLastUserMessage && "z-10 relative"
                    )}
                  >
                    <div className="flex flex-col gap-2 items-end max-w-[75%]">
                      <div className={cn(
                        "px-5 py-4 rounded-2xl rounded-tr-none break-word",
                        "bg-[#A6D0DD] text-black text-sm shadow-sm font-medium leading-relaxed"
                      )}>
                        <TextAnimate
                          animation="fadeIn"
                          by="line"
                          startOnView={false}
                          once={true}
                          className="text-black"
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
                className="flex items-start gap-4"
              >
                <div>
                  <AILoadingState />
                </div>
              </motion.div>
            )}
          </div>
        </ConversationContent>
      </Conversation>

      {/* Input - always at bottom */}
      <div className={cn(
        "w-full z-30 absolute bottom-0 left-0 pb-6 pt-10 bg-linear-to-t from-[#0F0F0F] via-[#0F0F0F]/90 to-transparent"
      )}>
        <div
          className="w-full mx-auto relative z-20 max-w-4xl px-4 md:px-12"
        >
          <ChatGPTPromptInput
            onSubmit={simulateResponse}
            loadingDuration={3000}
            submitted={isSubmitting}
            spotifyConnected={spotifyConnected}
            onSpotifyClick={handleSpotifyConnect}
            minHeight={56}
            maxHeight={200}
            className="bg-white/5 backdrop-blur-xl border-white/10 shadow-xl"
          />
        </div>
        </div>
      </div>
    </div>
  );
}

