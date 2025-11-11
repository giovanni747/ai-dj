"use client";

import { useEffect, useState, useRef } from "react";
import { useRive, Layout, Fit, Alignment, useStateMachineInput } from "@rive-app/react-canvas";
import { cn } from "@/lib/utils";

interface DjRiveAvatarProps {
  className?: string;
  size?: number;
  containerSize?: number; // Size of the containing div (gray circle)
  artboard?: string;
  stateMachine?: string;
  fit?: Fit;
  alignment?: Alignment;
  src?: string; // allow override; defaults to /dj_avatar.riv
  isTracking?: boolean; // Optional external control, otherwise tracks cursor
}

export function DjRiveAvatar({
  className,
  size = 120,
  containerSize, // If not provided, will be calculated as 80% of size
  artboard,
  stateMachine = "State Machine 1",
  fit = Fit.Cover,
  alignment = Alignment.Center,
  src = "/dj_avatar.riv",
  isTracking: externalIsTracking,
}: DjRiveAvatarProps) {
  const [isTracking, setIsTracking] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMoveTimeRef = useRef<number>(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Calculate container size (50% of avatar size if not specified - smaller background)
  const actualContainerSize = containerSize ?? Math.round(size * 0.5);

  const { RiveComponent, rive } = useRive({
    src,
    artboard,
    stateMachines: [stateMachine],
    autoplay: true,
    layout: new Layout({
      fit,
      alignment,
    }),
  });

  // Get all the state machine inputs
  const isTrackingInput = useStateMachineInput(rive, stateMachine, "IsTracking");
  const hitBoxInput = useStateMachineInput(rive, stateMachine, "hitBox");
  const hitBoxRInput = useStateMachineInput(rive, stateMachine, "hitBoxR");
  const hitBoxLInput = useStateMachineInput(rive, stateMachine, "hitBoxL");

  // Track cursor movement and position with larger tracking area
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      lastMoveTimeRef.current = now;
      
      // Set tracking to true immediately
      setIsTracking(true);
      
      // Calculate cursor position relative to avatar center
      // Use a larger tracking area (viewport-based) for more natural movement
      if (containerRef.current && rive) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Use a larger tracking radius (3x the avatar size) for smoother, more natural tracking
        const trackingRadius = size * 3;
        
        // Calculate relative position with larger tracking area
        const deltaX = e.clientX - centerX;
        const deltaY = e.clientY - centerY;
        
        // Normalize to -1 to 1 range based on tracking radius
        const relativeX = deltaX / trackingRadius;
        const relativeY = deltaY / trackingRadius;
        
        // Clamp values to -1 to 1 range
        const clampedX = Math.max(-1, Math.min(1, relativeX));
        const clampedY = Math.max(-1, Math.min(1, relativeY));
        
        // Update number inputs for head/eye tracking
        // Try different mappings - hitBox inputs might control:
        // Option 1: hitBox = X, hitBoxR = X (right eye), hitBoxL = X (left eye) - all horizontal
        // Option 2: hitBox = X, hitBoxR = Y, hitBoxL = X - mixed
        // Option 3: All use X for horizontal, or all use different combinations
        // Let's try: hitBox = X (head), hitBoxR = X (right eye), hitBoxL = X (left eye) for horizontal
        // And also try using Y for vertical movement if needed
        if (hitBoxInput) {
          // Main head tracking - use X for horizontal
          hitBoxInput.value = clampedX;
        }
        if (hitBoxRInput) {
          // Right eye tracking - try X for horizontal eye movement
          hitBoxRInput.value = clampedX;
        }
        if (hitBoxLInput) {
          // Left eye tracking - try X for horizontal eye movement (or Y for vertical)
          // Try X first for horizontal tracking
          hitBoxLInput.value = clampedX;
        }
      }
      
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Set tracking to false after 800ms of no movement
      timeoutRef.current = setTimeout(() => {
        const timeSinceLastMove = Date.now() - lastMoveTimeRef.current;
        if (timeSinceLastMove >= 800) {
          setIsTracking(false);
          
          // Reset hitBox values to center when not tracking
          if (hitBoxInput) hitBoxInput.value = 0;
          if (hitBoxRInput) hitBoxRInput.value = 0;
          if (hitBoxLInput) hitBoxLInput.value = 0;
        }
      }, 800);
    };

    // Add event listener to window for cursor tracking
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [rive, hitBoxInput, hitBoxRInput, hitBoxLInput, size]);

  // Update the IsTracking input - use external prop if provided, otherwise use cursor tracking
  const trackingValue = externalIsTracking !== undefined ? externalIsTracking : isTracking;
  
  useEffect(() => {
    if (isTrackingInput) {
      isTrackingInput.value = trackingValue;
    }
  }, [isTrackingInput, trackingValue]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "pointer-events-none select-none overflow-hidden rounded-full border border-white/10 bg-white/10 backdrop-blur-sm flex items-center justify-center",
        className
      )}
      style={{ width: actualContainerSize, height: actualContainerSize }}
      aria-hidden="true"
    >
      <div style={{ width: size, height: size }}>
        <RiveComponent />
      </div>
    </div>
  );
}


