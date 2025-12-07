import { useState, useCallback, useRef, useEffect } from 'react';

interface UseVapiTTSProps {
    onEnd?: () => void;
    voiceId?: string; // VAPI voice ID
}

export function useVapiTTS({ 
    onEnd, 
    voiceId = "jennifer-playht" // Default VAPI voice (Jennifer from PlayHT)
}: UseVapiTTSProps = {}) {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const isCancellingRef = useRef(false);
    const onEndRef = useRef(onEnd);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);

    useEffect(() => {
        onEndRef.current = onEnd;
    }, [onEnd]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (sourceRef.current) {
                sourceRef.current.stop();
                sourceRef.current = null;
            }
        };
    }, []);

    const speak = useCallback(async (text: string) => {
        if (isMuted || !text?.trim()) return;

        // Cancel any current speech
        isCancellingRef.current = true;
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        if (sourceRef.current) {
            try {
                sourceRef.current.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            sourceRef.current = null;
        }
        isCancellingRef.current = false;

        const apiKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
        if (!apiKey) {
            // Silently fallback to browser TTS (VAPI not configured)
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                // Cancel any current speech first
                window.speechSynthesis.cancel();
                
                const speakWithBrowserTTS = () => {
                    const utterance = new SpeechSynthesisUtterance(text);
                    
                    // Try to find a good voice
                    const voices = window.speechSynthesis.getVoices();
                    const preferredVoice = voices.find(v => v.name === 'Samantha') ||
                        voices.find(v => v.name.includes('Google US English')) ||
                        voices.find(v => v.lang.startsWith('en-US')) ||
                        voices[0];
                    
                    if (preferredVoice) {
                        utterance.voice = preferredVoice;
                    }
                    utterance.rate = 1.0;
                    utterance.pitch = 1.0;
                    
                    utterance.onstart = () => {
                        setIsSpeaking(true);
                        setIsLoading(false);
                    };
                    utterance.onend = () => {
                        setIsSpeaking(false);
                        setIsLoading(false);
                        onEndRef.current?.();
                    };
                    utterance.onerror = () => {
                        setIsSpeaking(false);
                        setIsLoading(false);
                    };
                    
                    window.speechSynthesis.speak(utterance);
                };
                
                // Chrome loads voices asynchronously
                const voices = window.speechSynthesis.getVoices();
                if (voices.length === 0) {
                    window.speechSynthesis.onvoiceschanged = () => {
                        speakWithBrowserTTS();
                        window.speechSynthesis.onvoiceschanged = null;
                    };
                } else {
                    speakWithBrowserTTS();
                }
            }
            return;
        }

        setIsLoading(true);
        setIsSpeaking(true);

        try {
            // Call VAPI TTS API through our backend endpoint
            const response = await fetch('/api/vapi-tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text.trim(),
                    voiceId: voiceId
                })
            });

            if (!response.ok) {
                throw new Error(`VAPI API error: ${response.statusText}`);
            }

            // Get audio blob
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            // Create and play audio
            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            audio.onplay = () => {
                setIsLoading(false);
                setIsSpeaking(true);
            };

            audio.onended = () => {
                setIsSpeaking(false);
                setIsLoading(false);
                URL.revokeObjectURL(audioUrl);
                audioRef.current = null;
                if (!isCancellingRef.current) {
                    onEndRef.current?.();
                }
            };

            audio.onerror = (e) => {
                console.error('VAPI Audio playback error:', e);
                setIsSpeaking(false);
                setIsLoading(false);
                URL.revokeObjectURL(audioUrl);
                audioRef.current = null;
            };

            await audio.play();

        } catch (error) {
            console.error('VAPI TTS Error:', error);
            setIsSpeaking(false);
            setIsLoading(false);
            
            // Fallback to browser TTS on error
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                console.log('Falling back to browser TTS');
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.onstart = () => setIsSpeaking(true);
                utterance.onend = () => {
                    setIsSpeaking(false);
                    onEndRef.current?.();
                };
                window.speechSynthesis.speak(utterance);
            }
        }
    }, [isMuted, voiceId]);

    const cancel = useCallback(() => {
        isCancellingRef.current = true;
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        if (sourceRef.current) {
            try {
                sourceRef.current.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            sourceRef.current = null;
        }
        setIsSpeaking(false);
        setIsLoading(false);
        isCancellingRef.current = false;
    }, []);

    const toggleMute = useCallback(() => {
        setIsMuted(prev => {
            const newState = !prev;
            if (newState) cancel();
            return newState;
        });
    }, [cancel]);

    return {
        speak,
        cancel,
        isSpeaking,
        isMuted,
        toggleMute,
        isLoading
    };
}

