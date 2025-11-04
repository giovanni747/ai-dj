"use client";

import { AIInputWithLoading } from "@/components/ui/ai-input-with-loading";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import AILoadingState from "@/components/kokonutui/ai-loading";
import { TextAnimate } from "@/components/ui/text-animate";
import { TrackList } from "@/components/ui/track-list";
import type { DJRecommendation, SpotifyTrack } from "@/types";

interface Message {
  role: "user" | "assistant";
  content: string;
  tracks?: SpotifyTrack[];
}

interface AIInputWithLoadingDemoProps {
  onAuthRequired?: () => Promise<boolean>;
}

export function AIInputWithLoadingDemo({ onAuthRequired }: AIInputWithLoadingDemoProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when messages update or while submitting
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isSubmitting]);

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
        const userMessage: Message = { role: "user", content: message };
        
        // Add assistant response with tracks
        const assistantMessage: Message = {
          role: "assistant",
          content: data.dj_response || "I'm ready to help you discover music!",
          tracks: data.tracks || []
        };
        
        setMessages(prev => [...prev, userMessage, assistantMessage]);
      } else {
        // Handle error with details from backend if available
        let errorText = "Sorry, I couldn't process your request. Please try again.";
        try {
          const errJson = await response.json();
          if (errJson?.error) errorText = typeof errJson.error === 'string' ? errJson.error : JSON.stringify(errJson.error);
        } catch {}
        const userMessage: Message = { role: "user", content: message };
        const errorMessage: Message = { role: "assistant", content: errorText };
        setMessages(prev => [...prev, userMessage, errorMessage]);
      }
    } catch (error) {
      console.error('Error submitting message:', error);
      const userMessage: Message = { role: "user", content: message };
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I'm having trouble connecting. Please make sure the backend is running."
      };
      setMessages(prev => [...prev, userMessage, errorMessage]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen min-w-[350px] sm:min-w-[500px] md:min-w-[710px] w-full">
      {/* Messages container - scrollable, positioned absolutely to allow centering */}
      <div 
        ref={messagesRef}
        className="absolute inset-0 overflow-y-auto no-scrollbar"
        style={{ paddingBottom: '160px' }} // Space for input at bottom
      >
        <div className={cn(
          "max-w-4xl w-full mx-auto px-4 flex flex-col gap-8 transition-all duration-300",
          (messages.length === 0 && !isSubmitting) ? "min-h-[calc(100vh-160px)] justify-center" : "pt-8 pb-8"
        )}>
          {messages.map((msg, i) => (
            <div key={i} className={cn(
              "flex flex-col gap-3",
              msg.role === "user" ? "items-end" : "items-start"
            )}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "px-4 py-3 rounded-2xl text-sm break-word",
                  msg.role === "user"
                    ? "max-w-[75%] bg-white/5 text-white backdrop-blur-md border border-white/10"
                    : "max-w-[85%] bg-gray-100 text-gray-900"
                )}
              >
                <TextAnimate 
                  animation="fadeIn" 
                  by="line"
                  startOnView={false}
                  once={true}
                  className={msg.role === "user" ? "text-white" : "text-gray-900"}
                >
                  {msg.content}
                </TextAnimate>
              </motion.div>
              
              {/* Display tracks if present */}
              {msg.tracks && msg.tracks.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="max-w-[85%] w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white">
                      🎵 Your Playlist ({msg.tracks.length} tracks)
                    </h3>
                  </div>
                  <TrackList tracks={msg.tracks} />
                </motion.div>
              )}
            </div>
          ))}
          {isSubmitting && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-start gap-2 mr-auto max-w-[75%]"
            >
              <div className="mt-1">
                <AILoadingState />
              </div>
            </motion.div>
          )}
        </div>
      </div>
      
      {/* Input - fixed at bottom, positioned higher */}
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

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
