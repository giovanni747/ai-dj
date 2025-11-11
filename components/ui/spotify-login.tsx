"use client";

import { cn } from "@/lib/utils";
import React, { useState, useRef, useEffect } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Music, LogIn } from "lucide-react";
import { motion, useInView, Variants, Transition } from "framer-motion";
import confetti from "canvas-confetti";
import { Spinner } from "@/components/ui/spinner";

// Confetti component
type Api = { fire: (options?: confetti.Options) => void };
const confettiDefaults = { spread: 360, ticks: 60, gravity: 0, decay: 0.94, startVelocity: 30, colors: ['#1DB954', '#191414'] };

// Glass button component
const glassButtonVariants = cva("relative isolate all-unset cursor-pointer rounded-full transition-all", { 
  variants: { 
    size: { 
      default: "text-base font-medium", 
      sm: "text-sm font-medium", 
      lg: "text-lg font-medium", 
      icon: "h-10 w-10" 
    } 
  }, 
  defaultVariants: { size: "default" } 
});

const glassButtonTextVariants = cva("glass-button-text relative block select-none tracking-tighter", { 
  variants: { 
    size: { 
      default: "px-6 py-3.5", 
      sm: "px-4 py-2", 
      lg: "px-8 py-4", 
      icon: "flex h-10 w-10 items-center justify-center" 
    } 
  }, 
  defaultVariants: { size: "default" } 
});

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof glassButtonVariants> { 
  contentClassName?: string; 
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, children, size, contentClassName, onClick, ...props }, ref) => {
    const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const button = e.currentTarget.querySelector('button');
      if (button && e.target !== button) button.click();
    };
    return (
      <div className={cn("glass-button-wrap cursor-pointer rounded-full relative", className)} onClick={handleWrapperClick}>
        <button className={cn("glass-button relative z-10", glassButtonVariants({ size }))} ref={ref} onClick={onClick} {...props}>
          <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>{children}</span>
        </button>
        <div className="glass-button-shadow rounded-full pointer-events-none"></div>
      </div>
    );
  }
);
GlassButton.displayName = "GlassButton";

// Blur fade component
interface BlurFadeProps { 
  children: React.ReactNode; 
  className?: string; 
  variant?: { hidden: { y: number }; visible: { y: number } }; 
  duration?: number; 
  delay?: number; 
  yOffset?: number; 
  inView?: boolean; 
  inViewMargin?: string; 
  blur?: string; 
}

function BlurFade({ children, className, variant, duration = 0.4, delay = 0, yOffset = 6, inView = true, inViewMargin = "-50px", blur = "6px" }: BlurFadeProps) {
  const ref = useRef(null);
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin as any });
  const isInView = !inView || inViewResult;
  const defaultVariants: Variants = {
    hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: -yOffset, opacity: 1, filter: `blur(0px)` },
  };
  const combinedVariants = variant || defaultVariants;
  return (
    <motion.div 
      ref={ref} 
      initial="hidden" 
      animate={isInView ? "visible" : "hidden"} 
      exit="hidden" 
      variants={combinedVariants} 
      transition={{ delay: 0.04 + delay, duration, ease: "easeOut" }} 
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Gradient background
const GradientBackground = () => (
  <>
    <style>
      {` 
        @keyframes float1 { 0% { transform: translate(0, 0); } 50% { transform: translate(-10px, 10px); } 100% { transform: translate(0, 0); } } 
        @keyframes float2 { 0% { transform: translate(0, 0); } 50% { transform: translate(10px, -10px); } 100% { transform: translate(0, 0); } } 
      `}
    </style>
    <svg width="100%" height="100%" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" className="absolute top-0 left-0 w-full h-full">
      <defs>
        <linearGradient id="rev_grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{stopColor: '#1DB954', stopOpacity: 0.8}} />
          <stop offset="100%" style={{stopColor: '#191414', stopOpacity: 0.6}} />
        </linearGradient>
        <linearGradient id="rev_grad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{stopColor: '#1DB954', stopOpacity: 0.9}} />
          <stop offset="50%" style={{stopColor: '#25D366', stopOpacity: 0.7}} />
          <stop offset="100%" style={{stopColor: '#1DB954', stopOpacity: 0.6}} />
        </linearGradient>
        <radialGradient id="rev_grad3" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{stopColor: '#1DB954', stopOpacity: 0.8}} />
          <stop offset="100%" style={{stopColor: '#191414', stopOpacity: 0.4}} />
        </radialGradient>
        <filter id="rev_blur1" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="35"/>
        </filter>
        <filter id="rev_blur2" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="25"/>
        </filter>
        <filter id="rev_blur3" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="45"/>
        </filter>
      </defs>
      <g style={{ animation: 'float1 20s ease-in-out infinite' }}>
        <ellipse cx="200" cy="500" rx="250" ry="180" fill="url(#rev_grad1)" filter="url(#rev_blur1)" transform="rotate(-30 200 500)"/>
        <rect x="500" y="100" width="300" height="250" rx="80" fill="url(#rev_grad2)" filter="url(#rev_blur2)" transform="rotate(15 650 225)"/>
      </g>
      <g style={{ animation: 'float2 25s ease-in-out infinite' }}>
        <circle cx="650" cy="450" r="150" fill="url(#rev_grad3)" filter="url(#rev_blur3)" opacity="0.7"/>
        <ellipse cx="50" cy="150" rx="180" ry="120" fill="#1DB954" filter="url(#rev_blur2)" opacity="0.8"/>
      </g>
    </svg>
  </>
);

interface SpotifyLoginProps {
  brandName?: string;
  onLoginClick?: () => void;
}

export const SpotifyLogin = ({ brandName = "AI DJ", onLoginClick }: SpotifyLoginProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleSpotifyLogin = () => {
    setIsLoading(true);
    
    // Fire confetti animation
    const fireConfetti = () => {
      if (canvasRef.current) {
        confetti({
          ...confettiDefaults,
          particleCount: 50,
        });
      }
    };
    
    fireConfetti();
    
    // Redirect to Flask backend Spotify OAuth
    setTimeout(() => {
      window.location.href = 'http://127.0.0.1:5001/';
    }, 500);
    
    if (onLoginClick) {
      onLoginClick();
    }
  };

  return (
    <div className="bg-background min-h-screen w-screen flex flex-col">
      <style>
        {`
          @property --angle-1 { syntax: "<angle>"; inherits: false; initial-value: -75deg; } 
          @property --angle-2 { syntax: "<angle>"; inherits: false; initial-value: -45deg; }
          .glass-button-wrap { --anim-time: 400ms; --anim-ease: cubic-bezier(0.25, 1, 0.5, 1); --border-width: clamp(1px, 0.0625em, 4px); position: relative; z-index: 2; transform-style: preserve-3d; transition: transform var(--anim-time) var(--anim-ease); } 
          .glass-button-wrap:has(.glass-button:active) { transform: rotateX(25deg); } 
          .glass-button-shadow { --shadow-cutoff-fix: 2em; position: absolute; width: calc(100% + var(--shadow-cutoff-fix)); height: calc(100% + var(--shadow-cutoff-fix)); top: calc(0% - var(--shadow-cutoff-fix) / 2); left: calc(0% - var(--shadow-cutoff-fix) / 2); filter: blur(clamp(2px, 0.125em, 12px)); transition: filter var(--anim-time) var(--anim-ease); pointer-events: none; z-index: 0; } 
          .glass-button-shadow::after { content: ""; position: absolute; inset: 0; border-radius: 9999px; background: linear-gradient(180deg, rgba(29, 185, 84, 0.2), rgba(29, 185, 84, 0.1)); width: calc(100% - var(--shadow-cutoff-fix) - 0.25em); height: calc(100% - var(--shadow-cutoff-fix) - 0.25em); top: calc(var(--shadow-cutoff-fix) - 0.5em); left: calc(var(--shadow-cutoff-fix) - 0.875em); padding: 0.125em; box-sizing: border-box; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; transition: all var(--anim-time) var(--anim-ease); opacity: 1; }
          .glass-button { -webkit-tap-highlight-color: transparent; backdrop-filter: blur(clamp(1px, 0.125em, 4px)); transition: all var(--anim-time) var(--anim-ease); background: linear-gradient(-75deg, rgba(29, 185, 84, 0.05), rgba(29, 185, 84, 0.2), rgba(29, 185, 84, 0.05)); box-shadow: inset 0 0.125em 0.125em rgba(29, 185, 84, 0.05), inset 0 -0.125em 0.125em rgba(29, 185, 84, 0.5), 0 0.25em 0.125em -0.125em rgba(29, 185, 84, 0.2), 0 0 0.1em 0.25em inset rgba(29, 185, 84, 0.2), 0 0 0 0 rgba(29, 185, 84, 0); } 
          .glass-button:hover { transform: scale(0.975); backdrop-filter: blur(0.01em); box-shadow: inset 0 0.125em 0.125em rgba(29, 185, 84, 0.05), inset 0 -0.125em 0.125em rgba(29, 185, 84, 0.5), 0 0.15em 0.05em -0.1em rgba(29, 185, 84, 0.25), 0 0 0.05em 0.1em inset rgba(29, 185, 84, 0.5), 0 0 0 0 rgba(29, 185, 84, 0); } 
          .glass-button-text { color: rgba(255, 255, 255, 0.9); text-shadow: 0em 0.25em 0.05em rgba(29, 185, 84, 0.1); transition: all var(--anim-time) var(--anim-ease); } 
          .glass-button:hover .glass-button-text { text-shadow: 0.025em 0.025em 0.025em rgba(29, 185, 84, 0.12); } 
          .glass-button-text::after { content: ""; display: block; position: absolute; width: calc(100% - var(--border-width)); height: calc(100% - var(--border-width)); top: calc(0% + var(--border-width) / 2); left: calc(0% + var(--border-width) / 2); box-sizing: border-box; border-radius: 9999px; overflow: clip; background: linear-gradient(var(--angle-2), transparent 0%, rgba(29, 185, 84, 0.5) 40% 50%, transparent 55%); z-index: 3; mix-blend-mode: screen; pointer-events: none; background-size: 200% 200%; background-position: 0% 50%; transition: background-position calc(var(--anim-time) * 1.25) var(--anim-ease), --angle-2 calc(var(--anim-time) * 1.25) var(--anim-ease); } 
          .glass-button:hover .glass-button-text::after { background-position: 25% 50%; } 
          .glass-button:active .glass-button-text::after { background-position: 50% 15%; --angle-2: -15deg; } 
          .glass-button::after { content: ""; position: absolute; z-index: 1; inset: 0; border-radius: 9999px; width: calc(100% + var(--border-width)); height: calc(100% + var(--border-width)); top: calc(0% - var(--border-width) / 2); left: calc(0% - var(--border-width) / 2); padding: var(--border-width); box-sizing: border-box; background: conic-gradient(from var(--angle-1) at 50% 50%, rgba(29, 185, 84, 0.5) 0%, transparent 5% 40%, rgba(29, 185, 84, 0.5) 50%, transparent 60% 95%, rgba(29, 185, 84, 0.5) 100%), linear-gradient(180deg, rgba(29, 185, 84, 0.5), rgba(29, 185, 84, 0.5)); mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; transition: all var(--anim-time) var(--anim-ease), --angle-1 500ms ease; box-shadow: inset 0 0 0 calc(var(--border-width) / 2) rgba(29, 185, 84, 0.5); pointer-events: none; } 
          .glass-button:hover::after { --angle-1: -125deg; } 
          .glass-button:active::after { --angle-1: -75deg; } 
          .glass-button-wrap:has(.glass-button:hover) .glass-button-shadow { filter: blur(clamp(2px, 0.0625em, 6px)); } 
          .glass-button-wrap:has(.glass-button:hover) .glass-button-shadow::after { top: calc(var(--shadow-cutoff-fix) - 0.875em); opacity: 1; } 
          .glass-button-wrap:has(.glass-button:active) .glass-button-shadow { filter: blur(clamp(2px, 0.125em, 12px)); } 
          .glass-button-wrap:has(.glass-button:active) .glass-button-shadow::after { top: calc(var(--shadow-cutoff-fix) - 0.5em); opacity: 0.75; } 
          .glass-button-wrap:has(.glass-button:active) .glass-button-text { text-shadow: 0.025em 0.25em 0.05em rgba(29, 185, 84, 0.12); } 
          .glass-button-wrap:has(.glass-button:active) .glass-button { box-shadow: inset 0 0.125em 0.125em rgba(29, 185, 84, 0.05), inset 0 -0.125em 0.125em rgba(29, 185, 84, 0.5), 0 0.125em 0.125em -0.125em rgba(29, 185, 84, 0.2), 0 0 0.1em 0.25em inset rgba(29, 185, 84, 0.2), 0 0.225em 0.05em 0 rgba(29, 185, 84, 0.05), 0 0.25em 0 0 rgba(29, 185, 84, 0.75), inset 0 0.25em 0.05em 0 rgba(29, 185, 84, 0.15); } 
        `}
      </style>

              {/* Confetti canvas */}
      <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full pointer-events-none z-50" />

      {/* Brand header */}
      <div className={cn("fixed top-4 left-4 z-20 flex items-center gap-2", "md:left-1/2 md:-translate-x-1/2")}>
        <div className="bg-[#1DB954] text-white rounded-md p-1.5">
          <Music className="h-4 w-4" />
        </div>
        <h1 className="text-base font-bold text-foreground">{brandName}</h1>
      </div>

      {/* Main content */}
      <div className={cn("flex w-full flex-1 h-full items-center justify-center bg-card", "relative overflow-hidden")}>
        <div className="absolute inset-0 z-0">
          <GradientBackground />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8 w-[280px] mx-auto p-4">
          <BlurFade delay={0} className="w-full">
            <div className="text-center">
              <p className="font-serif font-light text-4xl sm:text-5xl md:text-6xl tracking-tight text-foreground whitespace-nowrap">
                Welcome Back
              </p>
            </div>
          </BlurFade>

          <BlurFade delay={0.25 * 1}>
            <p className="text-sm font-medium text-muted-foreground text-center">
              Sign in with Spotify to get personalized music recommendations from your AI DJ
            </p>
          </BlurFade>

          <BlurFade delay={0.25 * 2}>
            <GlassButton 
              onClick={handleSpotifyLogin}
              disabled={isLoading}
              size="lg"
              contentClassName="flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" className="text-white" />
                  <span className="font-semibold text-foreground">Connecting...</span>
                </>
              ) : (
                <>
                  <Music className="w-5 h-5" />
                  <span className="font-semibold text-foreground">Continue with Spotify</span>
                </>
              )}
            </GlassButton>
          </BlurFade>

          <BlurFade delay={0.25 * 3}>
            <p className="text-xs text-muted-foreground text-center">
              Your privacy is important. We only access your music preferences to provide better recommendations.
            </p>
          </BlurFade>
        </div>
      </div>
    </div>
  );
};

