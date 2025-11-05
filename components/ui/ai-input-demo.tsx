"use client";

import { AIInputWithLoading } from "@/components/ui/ai-input-with-loading";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import AILoadingState from "@/components/kokonutui/ai-loading";
import { TextAnimate } from "@/components/ui/text-animate";
import { TrackList } from "@/components/ui/track-list";
import { TrackStack } from "@/components/ui/track-stack";
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
  onAuthRequired?: () => Promise<boolean>;
}

// Avatar URL - using Unsplash image for LLM
const ASSISTANT_AVATAR = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=100&h=100&fit=crop";

export function AIInputWithLoadingDemo({ onAuthRequired }: AIInputWithLoadingDemoProps) {
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
    const loadHistory = async () => {
      try {
        setIsLoadingHistory(true);

        // Check authentication first
        const authResponse = await fetch('/api/spotify-auth', {
          credentials: 'include',
        });

        if (!authResponse.ok) {
          console.log('User not authenticated, skipping history load');
          setIsLoadingHistory(false);
          return;
        }

        const authData = await authResponse.json();
        if (!authData.authenticated) {
          console.log('User not authenticated, skipping history load');
          setIsLoadingHistory(false);
          return;
        }

        console.log('User authenticated, loading chat history...');

        // Load chat history
        const historyResponse = await fetch('/api/chat-history?limit=50', {
          credentials: 'include',
        });

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

            console.log(`Loaded ${loadedMessages.length} messages from history`);
          }

          // Load liked tracks
          const likedTracksResponse = await fetch('/api/liked-tracks', {
            credentials: 'include',
          });

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

            console.log(`Loaded ${likedTrackIds.size} liked tracks`);
          }

          setMessages(loadedMessages);
        } else {
          console.error('Failed to load chat history:', historyResponse.status);
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, []);

  const simulateResponse = async (message: string) => {
    setIsSubmitting(true);
    
    // Check authentication before submitting
    if (onAuthRequired) {
      const authResult = await onAuthRequired();
      if (!authResult) {
        // Auth dialog will be shown by parent
        setIsSubmitting(false);
        return;
      }
    }
    
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
        <div className="animate-spin h-10 w-10 border-4 border-white/20 border-t-white rounded-full mb-3" />
        <p className="text-white/60 text-sm">Loading chat history...</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-screen min-w-[350px] sm:min-w-[500px] md:min-w-[710px] w-full">
      {/* Messages container - using Conversation component */}
      <Conversation 
        className={cn(
          "absolute inset-0 no-scrollbar overflow-y-auto",
          (messages.length === 0 && !isSubmitting) && "flex items-center justify-center"
        )}
        style={{ paddingBottom: '100px' }}
      >
        <ConversationContent>
          <div className={cn(
            "max-w-4xl w-full mx-auto flex flex-col",
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
                {/* LLM Avatar - only for assistant, positioned at top-left */}
                {msg.role === "assistant" && (
                  <div className="shrink-0">
                    <MessageAvatar
                      src={ASSISTANT_AVATAR}
                      name="AI DJ"
                    />
                  </div>
                )}
                
                <div className={cn(
                  "flex flex-col gap-2",
                  msg.role === "user" ? "items-end max-w-[75%]" : "items-start max-w-[85%]"
                )}>
                  <div className={cn(
                    "px-4 py-3 rounded-2xl text-sm break-word",
                    msg.role === "user"
                      ? "bg-white/5 text-white backdrop-blur-md border border-white/10"
                      : "bg-gray-100 text-gray-900"
                  )}>
                    <TextAnimate 
                      animation="fadeIn" 
                      by="line"
                      startOnView={false}
                      once={true}
                      className={msg.role === "user" ? "text-white" : "text-gray-900"}
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
                        <TrackStack tracks={msg.tracks} />
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
                className="flex items-start gap-2"
              >
                <MessageAvatar
                  src={ASSISTANT_AVATAR}
                  name="AI DJ"
                />
                <div className="mt-1">
                  <AILoadingState />
                </div>
              </motion.div>
            )}
          </div>
        </ConversationContent>
      </Conversation>
      
      {/* Input - fixed at bottom */}
      <div className="absolute bottom-4 left-0 right-0 pointer-events-none">
        <div className="pt-2">
          <motion.div
            animate={{ 
              y: isSubmitting ? 30 : 0,
              scale: isSubmitting ? 0.95 : 1
            }}
            transition={{ 
              type: "tween", 
              duration: 0.5,
              ease: "easeInOut"
            }}
            className="max-w-4xl w-full mx-auto px-4 pointer-events-auto"
          >
            <AIInputWithLoading 
              onSubmit={simulateResponse}
              loadingDuration={3000}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

