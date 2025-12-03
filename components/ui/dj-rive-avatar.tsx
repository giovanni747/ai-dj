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
  isTyping?: boolean;
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
  isTyping,
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
  const xAxisInput = useStateMachineInput(rive, stateMachine, "xAxis");
  const yAxisInput = useStateMachineInput(rive, stateMachine, "yAxis");

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

        // Map -1...1 to 0...100 for standard Rive tracking
        const mapToRange = (val: number) => (val + 1) * 50;
        const targetX = mapToRange(clampedX);
        const targetY = mapToRange(clampedY); // Invert Y if needed, but usually 0 is top, 100 is bottom

        if (xAxisInput) xAxisInput.value = targetX;
        if (yAxisInput) yAxisInput.value = targetY;

        // Keep existing inputs but maybe they expect -100 to 100 or similar?
        // If the user said "it isnt tracking", likely the above inputs were missing.
        // We'll leave these as is for now but ensure they get values.
        if (hitBoxInput) hitBoxInput.value = clampedX * 100; // Try larger range?
        if (hitBoxRInput) hitBoxRInput.value = clampedX * 100;
        if (hitBoxLInput) hitBoxLInput.value = clampedX * 100;
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
          if (xAxisInput) xAxisInput.value = 50; // Center
          if (yAxisInput) yAxisInput.value = 50; // Center
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
  }, [rive, hitBoxInput, hitBoxRInput, hitBoxLInput, xAxisInput, yAxisInput, size]);

  // Update the IsTracking input - use external prop if provided, otherwise use cursor tracking
  const trackingValue = externalIsTracking !== undefined ? externalIsTracking : isTracking;

  useEffect(() => {
    if (isTrackingInput && rive) {
      try {
        isTrackingInput.value = trackingValue;
      } catch (e) {
        // Ignore errors if runtime is not ready or disposed
      }
    }
  }, [isTrackingInput, trackingValue, rive]);

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


