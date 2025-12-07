"use client";

import { ChatGPTPromptInput } from "@/components/ui/chatgpt-prompt-input";
import { useState, useEffect, Fragment, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import AILoadingState from "@/components/kokonutui/ai-loading";
import Loader from "@/components/kokonutui/loader";
import { TextAnimate } from "@/components/ui/text-animate";
import { TrackList } from "@/components/ui/track-list";
import type { DJRecommendation, SpotifyTrack } from "@/types";
import {
  ThumbsDownIcon,
  ThumbsUpIcon,
  Volume2, VolumeX
} from "lucide-react";
import { useElevenLabsTTS } from "@/components/hooks/use-elevenlabs-tts";
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
import type { ImageCard } from "@/components/ui/image-carousel-hero";
import { MorphicNavbar, type NavTab } from "@/components/kokonutui/morphic-navbar";
import { RadialIntro, type OrbitItem } from "@/components/ui/radial-intro";
import { HandWrittenTitle } from "@/components/ui/hand-writing-text";
import { DashboardTab } from "@/components/ui/dashboard-tab";
import { PersonalTab } from "@/components/ui/personal-tab";

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

// Default artists for the radial intro
const DEFAULT_ARTISTS: OrbitItem[] = [
  { id: 1, name: 'The Weeknd', src: 'https://media.glamour.com/photos/5ff5b1f8e28e18c5c7f5372f/master/w_2560%2Cc_limit/the-weeknd.png' },
  { id: 2, name: 'Drake', src: 'https://i.scdn.co/image/ab6761610000e5eb4293385d324db8558179afd9' },
  { id: 3, name: 'Taylor Swift', src: 'https://i.scdn.co/image/ab6761610000e5eb5a00969a4698c3132a15fbb0' },
  { id: 4, name: 'Bad Bunny', src: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRf2rttn1IRczYAq6OMlwP1w8ogk0Yt8gWRHg&s' },
  { id: 5, name: 'Dua Lipa', src: 'https://www.corazon.cl/wp-content/uploads/2015/02/planb_conciertonuevayork.jpg' },
  { id: 6, name: 'Kendrick Lamar', src: 'https://i.scdn.co/image/ab6761610000e5eb437b9e2a82505b3d93ff1022' },
  { id: 7, name: 'Ariana Grande', src: 'https://www.billboard.com/wp-content/uploads/2022/08/Ariana-Grande-the-voice-2021-billboard-1548.jpg?w=875&h=583&crop=1' },
  { id: 8, name: 'Beyonce', src: 'https://yt3.googleusercontent.com/DFAj5Pcujo1P0iXe8x4XoZwwItN9cbHnDxbdamvhqSTzXTmyNlqsE1HN2bEQN5vpXE6SB1IAoCM=s900-c-k-c0x00ffffff-no-rj' },
];

export function AIInputWithLoadingDemo({
  spotifyConnected = false
}: AIInputWithLoadingDemoProps) {
  const { isSignedIn } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [frequentlyLikedTerms, setFrequentlyLikedTerms] = useState<Set<string>>(new Set());
  const [heroImages, setHeroImages] = useState<ImageCard[]>([]);
  const [activeTab, setActiveTab] = useState<NavTab>("dj");
  // Manage bubble visibility
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);

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
        // Silently handle expected error cases - don't log as error
        const status = response.status;
        if (status === 401 || status === 403) {
          // User not authenticated - this is expected
          return;
        }
        if (status === 404) {
          // User has no frequently liked terms yet - this is normal
        return;
      }
        // Only log unexpected errors as warnings (not errors)
        if (status >= 500) {
          console.warn('Backend error loading frequently liked terms:', status);
        }
        // For other status codes, silently fail
      }
    } catch {
      // Silently fail if network error - don't log as error
      // This is not critical functionality, so we don't need to alert the user
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
          const data = await response.json() as { top_artists?: Array<{ name: string; images?: Array<{ url: string }> }> };
          if (data.top_artists) {
            const images: ImageCard[] = data.top_artists
              .filter((artist) => artist.images && artist.images.length > 0)
              .map((artist, index: number) => ({
                id: `artist-${index}`,
                src: artist.images![0].url,
                alt: artist.name,
                rotation: (index * 10) - 10 // Slight rotation variation
              }))
              .slice(0, 8); // Take top 8 to match default artist count
            
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

  // Auto-scroll to bottom when messages change or submission state changes
  /*
  useEffect(() => {
    if (scrollContainerRef.current) {
      const scrollElement = scrollContainerRef.current;
      
      // Small delay to ensure content is rendered
      setTimeout(() => {
        scrollElement.scrollTo({
          top: scrollElement.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [messages, isSubmitting]);
  */

  // Clear messages and reset state when user signs out
  useEffect(() => {
    if (!isSignedIn) {
      console.log('User signed out - clearing state');
      setMessages([]);
      setFrequentlyLikedTerms(new Set());
      setHeroImages([]);
      historyLoadedRef.current = false;
      hasNewMessagesRef.current = false;
      setIsLoadingHistory(false);
    }
  }, [isSignedIn]);

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

  // ElevenLabs Text-to-Speech Hook (falls back to browser TTS if not configured)
  const { speak, cancel, isMuted, toggleMute, isSpeaking } = useElevenLabsTTS({
    voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel - popular default voice
    // Other great voices: 'EXAVITQu4vr4xnSDxMaL', 'VR6AewLTigWG4xSOukaG', 'ThT5KcBeYPX3keUQqHPh'
  });

  // Manage bubble visibility effect
  // Only update when the message ID actually changes to prevent flashing
  useEffect(() => {
    const messageId = latestAssistantMessage?.id;
    const messageContent = latestAssistantMessage?.content?.trim();
    
    // If we have a new message (different ID)
    if (messageId && messageId !== lastMessageId) {
      setLastMessageId(messageId);

      // Speak the message only if we have content
      if (messageContent) {
        speak(messageContent);
      }
    } 
    // If message was removed (no latest message)
    else if (!latestAssistantMessage && lastMessageId) {
      setLastMessageId(null);
      cancel();
    }
    // If we have the same message ID, don't do anything (prevent flashing)
    // The bubble should already be visible from the previous render
  }, [latestAssistantMessage, lastMessageId, speak, cancel]);

  // Compute hasMessages (used in multiple places)
  const hasMessages = messages.length > 0 || isSubmitting;

  // Compute orbit items for radial intro - merge user artists with defaults
  const orbitItems: OrbitItem[] = useMemo(() => {
    const userArtists: OrbitItem[] = heroImages.map(img => ({ 
      id: img.id, 
      name: img.alt, 
      src: img.src 
    }));
    
    // If user has artists, use them and fill remaining slots with defaults
    if (userArtists.length > 0) {
      const neededCount = DEFAULT_ARTISTS.length;
      const defaultArtistsToUse = DEFAULT_ARTISTS.slice(userArtists.length);
      return [...userArtists, ...defaultArtistsToUse].slice(0, neededCount);
    }
    
    // If no user artists, use all defaults
    return DEFAULT_ARTISTS;
  }, [heroImages]);


  const simulateResponse = async (message: string, selectedTool?: string | null) => {
    setIsSubmitting(true);

    // Spotify authentication is required - user must be authenticated to use the app

    try {
      // Get user location if weather tool is selected
      let location: { lat?: number; lon?: number } | null = null;
      if (selectedTool === 'weather') {
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error('Geolocation is not supported by this browser'));
              return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              enableHighAccuracy: false
            });
            });
            location = {
              lat: position.coords.latitude,
              lon: position.coords.longitude
            };
          console.log('📍 User location obtained:', location);
        } catch (error) {
          console.warn('⚠️ Could not get user location, will use default:', error);
            // Continue without location - backend will use default
          }
        }

      // Call the Next.js API route which forwards to Flask backend
      const response = await fetch('/api/dj-recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          message, 
          tool: selectedTool || null,
          location: location || null
        }),
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
        <div className={cn(
          "relative h-[300px] shrink-0 rounded-[32px] p-4 flex flex-col items-center justify-center shadow-xl overflow-visible group transition-colors duration-500",
          isSpeaking ? "bg-[#F3E2A0]" : "bg-[#0F0F0F] border border-white/5"
        )}>
          {/* Mute Toggle Button - Absolute Top Right of Card */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className={cn(
              "absolute top-4 right-4 p-2 rounded-full transition-all z-40",
              isSpeaking 
                ? "bg-black/5 hover:bg-black/10 text-black" 
                : "bg-white/5 hover:bg-white/10 text-white",
              isMuted ? "opacity-50" : "opacity-100"
            )}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <div className={cn(
            "text-[10px] font-bold tracking-widest absolute top-4 left-4 transition-colors duration-500",
            isSpeaking ? "text-black/40" : "text-white/40"
          )}>AI DJ</div>
          
          {/* Avatar Container - Centered & No Glass Background */}
          <div className="w-full flex justify-center items-center z-10">
            <div className="w-[280px] h-[240px]">
              <DynamicRiveAvatar
                size={440}
                src="/dj_avatar.riv"
                stateMachine="State Machine 1"
                isTyping={false}
                className="bg-transparent border-none backdrop-blur-none"
                containerSize={280}
              />
                  </div>
                  </div>
      </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 relative flex flex-col h-full bg-[#0F0F0F] rounded-3xl overflow-hidden shadow-2xl border border-white/5">
        {/* Navbar - centered in this container */}
        <div className="absolute top-4 left-0 right-0 z-30 flex justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <MorphicNavbar activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
        </div>

        <WebGLShader 
          className="absolute inset-0 w-full h-full pointer-events-none" 
          speed={isMusicPlaying ? 0.08 : 0.01}
        />
        
      {/* Messages container - using Conversation component - fills remaining space */}
      <Conversation
        ref={scrollContainerRef}
          className="absolute inset-0 no-scrollbar overflow-y-auto z-0"
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
          <ConversationContent className={hasMessages ? "pt-20 pb-32" : "pt-[10vh] pb-20 flex flex-col justify-start min-h-full"}>
          {/* Render tab content */}
          {activeTab === "dashboard" && <DashboardTab />}
          {activeTab === "personal" && <PersonalTab />}
          
          {/* Show DJ chat only when on DJ tab */}
          {activeTab === "dj" && (
          <div className={cn(
              "max-w-4xl w-full mx-auto flex flex-col gap-8 px-4 md:px-12",
            (messages.length === 0 && !isSubmitting) ? "items-center justify-center" : ""
          )}>
            {messages.length === 0 && !isSubmitting && (
              <div className="w-full h-full flex items-center justify-center">
                <RadialIntro 
                  orbitItems={orbitItems}
                  stageSize={470}
                  centerContent={
                    <HandWrittenTitle 
                      title={<>Hi, there <span className="animate-wave inline-block">👋</span></>}
                      subtitle="Tell me what you want to hear, and I'll handle the mix."
                    />
                  }
                />
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
                            "bg-white/5 backdrop-blur-md border border-white/10"
                          )}
                        >
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                                🎵 Your Playlist <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/60">{msg.tracks.length}</span>
                              </h3>
                            </div>
                            <TrackList
                              tracks={msg.tracks}
                              likedTracks={msg.likedTracks || new Set()}
                              onToggleLike={(trackId) => handleToggleTrackLike(msg.id, trackId)}
                              frequentlyLikedTerms={frequentlyLikedTerms}
                            onPlaybackChange={setIsMusicPlaying}
                            />
                        </motion.div>

                        {/* Action buttons for assistant messages - like, dislike */}
                        <Actions className="mt-2">
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
          )}
        </ConversationContent>
      </Conversation>

      {/* Input - only show on DJ tab */}
      {activeTab === "dj" && (
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
      )}
      </div>
    </div>
  );
}

