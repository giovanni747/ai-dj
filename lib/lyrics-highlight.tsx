"use client";

import React from "react";
import { Highlighter } from "@/components/ui/highlighter";

/**
 * Highlights specific terms in lyrics text
 * @param lyrics - The full lyrics text
 * @param highlightedTerms - Array of terms to highlight (exact matches from lyrics)
 * @returns JSX with highlighted terms wrapped in Highlighter components
 */
export function highlightLyricsTerms(
  lyrics: string,
  highlightedTerms: string[] = []
): React.ReactNode {
  if (!highlightedTerms || highlightedTerms.length === 0) {
    return lyrics;
  }

  // Sort terms by length (longest first) to handle overlapping matches correctly
  const sortedTerms = [...highlightedTerms].filter(term => term && term.trim().length > 0)
    .sort((a, b) => b.length - a.length);
  
  if (sortedTerms.length === 0) {
    return lyrics;
  }
  
  // Create a regex pattern that matches any of the terms (case-insensitive)
  // Escape special regex characters in terms
  const escapedTerms = sortedTerms.map(term => 
    term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  
  // Build pattern: use word boundaries for single words, allow phrases to match anywhere
  const patternParts = escapedTerms.map(term => {
    const trimmed = term.trim();
    // If it's a single word, use word boundaries
    if (trimmed.split(/\s+/).length === 1) {
      return `\\b${trimmed}\\b`;
    }
    // For phrases, match as-is (case-insensitive)
    return trimmed;
  });
  
  const pattern = new RegExp(`(${patternParts.join('|')})`, 'gi');

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyCounter = 0;
  
  // Reset regex lastIndex to avoid issues with global regex
  pattern.lastIndex = 0;
  
  while ((match = pattern.exec(lyrics)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(lyrics.substring(lastIndex, match.index));
    }
    
    // Add the highlighted match (preserve original casing from lyrics)
    const matchedText = match[0];
    parts.push(
      <Highlighter
        key={`highlight-${match.index}-${keyCounter++}`}
        action="highlight"
        color="#FFD700"
        strokeWidth={2}
        animationDuration={600}
        iterations={2}
        padding={1}
        multiline={true}
        isView={true}
      >
        {matchedText}
      </Highlighter>
    );
    
    lastIndex = match.index + matchedText.length;
    
    // Prevent infinite loop if regex doesn't advance
    if (match.index === pattern.lastIndex) {
      pattern.lastIndex++;
    }
  }
  
  // Add remaining text after the last match
  if (lastIndex < lyrics.length) {
    parts.push(lyrics.substring(lastIndex));
  }
  
  // If no matches found, return original text
  if (parts.length === 0) {
    return lyrics;
  }
  
  return <>{parts}</>;
}

