"use client";

import { AIInputWithLoading } from "@/components/ui/ai-input-with-loading";
import { useState, useEffect } from "react";
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
import { MessageAvatar } from "@/components/ui/message";
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
      }
    } catch (error) {
      console.error('Error saving track like:', error);
    }
  };


  // Load chat history and liked tracks on mount
  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const loadHistory = async () => {
      try {
        if (!isMounted) return;
        setIsLoadingHistory(true);

        console.log('🔄 Loading chat history...');

        // Load chat history (Clerk auth is handled by the API route)
        const historyResponse = await fetch('/api/chat-history?limit=50', {
          credentials: 'include',
          signal: abortController.signal,
        });

        if (!isMounted) return;

        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          console.log('📦 Chat history response:', historyData);
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

            console.log(`✅ Loaded ${loadedMessages.length} messages from history`);
            console.log('📝 Messages:', loadedMessages.map(m => ({ role: m.role, content: m.content.substring(0, 50) })));
          } else {
            console.log('ℹ️ No messages in history yet');
          }

          // Load liked tracks
          const likedTracksResponse = await fetch('/api/liked-tracks', {
            credentials: 'include',
            signal: abortController.signal,
          });

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

            console.log(`✅ Loaded ${likedTrackIds.size} liked tracks`);
          }

          if (isMounted) {
            setMessages(loadedMessages);
            console.log('✅ Messages set to state, count:', loadedMessages.length);
          }
        } else if (historyResponse.status === 401) {
          console.log('⚠️ User not authenticated with Clerk, skipping history load');
        } else {
          console.error('❌ Failed to load chat history:', historyResponse.status);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('🛑 Chat history request aborted (likely due to React Strict Mode)');
        } else {
          console.error('❌ Error loading chat history:', error);
        }
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    };

    loadHistory();

    // Cleanup function
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

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
          
          // Log lyrics for each track (first 200 chars)
          data.tracks.forEach((track: SpotifyTrack) => {
            if (track.lyrics) {
              console.log(`\n🎵 ${track.name} by ${track.artist}:`);
              console.log(`   Lyrics (${track.lyrics.length} chars): ${track.lyrics.substring(0, 200)}...`);
              if (track.lyrics_explanation) {
                console.log(`   Explanation: ${track.lyrics_explanation}`);
              }
            }
          });
        }
        
        // Add user message
        const userMessageId = generateMessageId();
        const userMessage: Message = { 
          id: userMessageId,
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
      setMessages(prev => [...prev, userMessage, errorMessage]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading indicator while loading history
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

  const hasMessages = messages.length > 0 || isSubmitting;

  // Handle Spotify connect button click
  const handleSpotifyConnect = () => {
    window.location.href = 'http://127.0.0.1:5001/';
  };

  return (
    <div className="relative flex flex-col h-screen min-w-[350px] sm:min-w-[500px] md:min-w-[710px] w-full">
      {/* Top-left Rive DJ avatar */}
      {/* Requires @rive-app/react-canvas and /public/dj_avatar.riv */}
      <div className="absolute top-3 left-3 z-20">
        {/* Lazy import to avoid SSR issues */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <DynamicRiveAvatar
          size={400}
          src="/dj_avatar.riv"
          stateMachine="State Machine 1"
        />
      </div>
      {/* Messages container - using Conversation component */}
      <Conversation 
        className={cn(
          "flex-1 no-scrollbar overflow-y-auto relative",
          !hasMessages && "flex items-center justify-center"
        )}
        style={{ 
          overscrollBehavior: 'contain'
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
        <ConversationContent className={hasMessages ? "pt-13 pb-8" : ""}>
          <div className={cn(
            "max-w-3xl w-full mx-auto flex flex-col",
            (messages.length === 0 && !isSubmitting) ? "items-center justify-center" : ""
          )}>
            {messages.length === 0 && !isSubmitting && (
              <div className="text-center text-gray-400 text-sm">
                Start a conversation with your AI DJ
              </div>
            )}
            
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "w-full flex gap-2 py-4",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  "flex flex-col gap-2",
                  msg.role === "user" ? "items-end max-w-[75%]" : "items-start max-w-[85%]"
                )}>
                  {msg.role === "assistant" && !msg.tracks && (
                    <h3 className="text-lg font-bold text-white mb-1">
                      AI DJ
                    </h3>
                  )}
                  <div className={cn(
                    "px-4 py-3 rounded-2xl break-word",
                    msg.role === "user"
                      ? "bg-white/5 text-white backdrop-blur-md border border-white/10 text-sm"
                      : "bg-transparent text-white text-base leading-relaxed"
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
                  
                  {/* Display tracks if present - with glass div styling */}
                  {msg.tracks && msg.tracks.length > 0 && (
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
                        />
                      )}
                    </motion.div>
                  )}
                  
                  {/* Action buttons for assistant messages - like, dislike, and switch */}
                  {msg.role === "assistant" && (
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
                  )}
                </div>
              </motion.div>
            ))}
            
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
      
      {/* Input - always at bottom, centered when no messages */}
      <div className={cn(
        "w-full shrink-0",
        !hasMessages && "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      )}>
        <motion.div
          animate={{ 
            y: isSubmitting && hasMessages ? 30 : 0,
            scale: isSubmitting && hasMessages ? 0.95 : 1
          }}
          transition={{ 
            type: "tween", 
            duration: 0.5,
            ease: "easeInOut"
          }}
          className={cn(
            "w-full mx-auto",
            hasMessages 
              ? "max-w-208 px-4 py-4" 
              : "max-w-3xl px-4 pointer-events-auto"
          )}
        >
          <AIInputWithLoading 
            onSubmit={simulateResponse}
            loadingDuration={3000}
            spotifyConnected={spotifyConnected}
            onSpotifyClick={handleSpotifyConnect}
          />
        </motion.div>
      </div>
    </div>
  );
}

