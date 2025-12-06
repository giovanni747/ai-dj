"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SpotifyTrack } from "@/types";
import { getAlbumArt } from "@/lib/track-utils";

interface DragCardsProps {
  tracks: SpotifyTrack[];
}

export const DragCards = ({ tracks }: DragCardsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  if (!tracks || tracks.length === 0) {
    return null;
  }

  // Generate random positions and rotations for each card
  const getCardProps = (index: number) => {
    const positions = [
      { top: "20%", left: "25%", rotate: "6deg" },
      { top: "45%", left: "60%", rotate: "12deg" },
      { top: "20%", left: "40%", rotate: "-6deg" },
      { top: "50%", left: "40%", rotate: "8deg" },
      { top: "20%", left: "65%", rotate: "18deg" },
      { top: "35%", left: "55%", rotate: "-3deg" },
      { top: "60%", left: "30%", rotate: "10deg" },
      { top: "70%", left: "50%", rotate: "-8deg" },
      { top: "30%", left: "15%", rotate: "5deg" },
      { top: "55%", left: "70%", rotate: "-12deg" },
    ];

    const sizes = [
      "w-36 md:w-56",
      "w-24 md:w-48",
      "w-52 md:w-80",
      "w-48 md:w-72",
      "w-40 md:w-64",
      "w-24 md:w-48",
      "w-32 md:w-56",
      "w-44 md:w-68",
      "w-28 md:w-52",
      "w-36 md:w-60",
    ];

    const posIndex = index % positions.length;
    const sizeIndex = index % sizes.length;

    return {
      ...positions[posIndex],
      className: sizes[sizeIndex],
    };
  };

  return (
    <div className="absolute inset-0 z-10" ref={containerRef}>
      {tracks.slice(0, 20).map((track, index) => {
        const cardProps = getCardProps(index);
        const albumArt = getAlbumArt(track.album?.images || [], "medium") || "/placeholder-album.png";

        return (
          <Card
            key={track.id}
            containerRef={containerRef}
            src={albumArt}
            alt={`${track.name} by ${track.artist}`}
            track={track}
            top={cardProps.top}
            left={cardProps.left}
            rotate={cardProps.rotate}
            className={cardProps.className}
          />
        );
      })}
    </div>
  );
};

interface CardProps {
  containerRef: React.RefObject<HTMLDivElement>;
  src: string;
  alt: string;
  track: SpotifyTrack;
  top: string;
  left: string;
  rotate: string;
  className?: string;
}

const Card = ({ containerRef, src, alt, top, left, rotate, className, track }: CardProps) => {
  const [zIndex, setZIndex] = useState(0);

  const updateZIndex = () => {
    const els = document.querySelectorAll(".drag-elements");

    let maxZIndex = -Infinity;

    els.forEach((el) => {
      const zIndexValue = parseInt(
        window.getComputedStyle(el).getPropertyValue("z-index")
      );

      if (!isNaN(zIndexValue) && zIndexValue > maxZIndex) {
        maxZIndex = zIndexValue;
      }
    });

    setZIndex(maxZIndex + 1);
  };

  return (
    <motion.div
      onMouseDown={updateZIndex}
      style={{
        top,
        left,
        rotate,
        zIndex,
      }}
      className={cn(
        "drag-elements absolute bg-neutral-200 p-1 pb-4 rounded-lg shadow-xl cursor-grab active:cursor-grabbing overflow-hidden group",
        className
      )}
      drag
      dragConstraints={containerRef}
      dragElastic={0.65}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="relative w-full h-full aspect-square">
        {src && src !== "/placeholder-album.png" ? (
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover rounded"
            draggable={false}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder-album.png";
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 rounded flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-12 h-12 text-white/80"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
            </svg>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-2 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-white text-xs font-semibold truncate">{track.name}</p>
          <p className="text-white/80 text-[10px] truncate">{track.artist}</p>
        </div>
      </div>
    </motion.div>
  );
};

