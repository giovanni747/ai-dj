import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTextToSpeechProps {
    onEnd?: () => void;
}

export function useTextToSpeech({ onEnd }: UseTextToSpeechProps = {}) {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const isCancellingRef = useRef(false);
    const onEndRef = useRef(onEnd);
    
    // Keep onEnd ref up to date without causing dependency changes
    useEffect(() => {
        onEndRef.current = onEnd;
    }, [onEnd]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            synthRef.current = window.speechSynthesis;

            const loadVoices = () => {
                const availableVoices = synthRef.current?.getVoices() || [];
                setVoices(availableVoices);

                // Try to find a good English voice
                // Prioritize "Samantha" (Mac) or "Google US English" or just the first English one
                const preferredVoice = availableVoices.find(v => v.name === 'Samantha') ||
                    availableVoices.find(v => v.name.includes('Google US English')) ||
                    availableVoices.find(v => v.lang.startsWith('en-US')) ||
                    availableVoices[0];

                setSelectedVoice(preferredVoice || null);
            };

            loadVoices();

            // Chrome loads voices asynchronously
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = loadVoices;
            }
        }
    }, []);

    const speak = useCallback((text: string) => {
        if (isMuted || !synthRef.current || !selectedVoice || !text?.trim()) return;

        // Cancel any current speech
        isCancellingRef.current = true;
        if (currentUtteranceRef.current) {
            // Remove error handler before canceling to prevent error logs
            currentUtteranceRef.current.onerror = null;
        }
        synthRef.current.cancel();
        isCancellingRef.current = false;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = selectedVoice;
        utterance.rate = 1.0; // Normal speed
        utterance.pitch = 1.0; // Normal pitch

        utterance.onstart = () => {
            setIsSpeaking(true);
            currentUtteranceRef.current = utterance;
        };
        utterance.onend = () => {
            setIsSpeaking(false);
            if (currentUtteranceRef.current === utterance) {
                currentUtteranceRef.current = null;
            }
            onEndRef.current?.();
        };
        utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
            // Only log errors if we're not intentionally canceling
            if (!isCancellingRef.current) {
                const errorInfo = {
                    error: e.error,
                    type: e.type,
                    message: e.error === 'not-allowed' ? 'TTS permission denied' :
                             e.error === 'synthesis-failed' ? 'TTS synthesis failed' :
                             e.error === 'synthesis-unavailable' ? 'TTS unavailable' :
                             e.error === 'text-too-long' ? 'Text too long' :
                             e.error === 'invalid-argument' ? 'Invalid argument' :
                             'Unknown TTS error'
                };
                console.error("TTS Error:", errorInfo);
            }
            setIsSpeaking(false);
            if (currentUtteranceRef.current === utterance) {
                currentUtteranceRef.current = null;
            }
        };

        currentUtteranceRef.current = utterance;
        synthRef.current.speak(utterance);
    }, [isMuted, selectedVoice]);

    const cancel = useCallback(() => {
        if (synthRef.current) {
            isCancellingRef.current = true;
            if (currentUtteranceRef.current) {
                // Remove error handler before canceling to prevent error logs
                currentUtteranceRef.current.onerror = null;
            }
            synthRef.current.cancel();
            setIsSpeaking(false);
            currentUtteranceRef.current = null;
            isCancellingRef.current = false;
        }
    }, []);

    const toggleMute = useCallback(() => {
        setIsMuted(prev => {
            const newState = !prev;
            if (newState) cancel(); // Stop speaking if muted
            return newState;
        });
    }, [cancel]);

    return {
        speak,
        cancel,
        isSpeaking,
        isMuted,
        toggleMute,
        voices,
        selectedVoice,
        setSelectedVoice
    };
}
