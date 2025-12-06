"use client";

import React from "react";
import { Highlighter } from "@/components/ui/highlighter";

/**
 * Highlights specific terms in lyrics text
 * @param lyrics - The full lyrics text
 * @param highlightedTerms - Array of terms to highlight (exact matches from lyrics)
 * @param frequentlyLikedTerms - Set of terms that appear frequently in liked tracks (case-insensitive)
 * @returns JSX with highlighted terms wrapped in Highlighter components
 */
export function highlightLyricsTerms(
  lyrics: string,
  highlightedTerms: string[] = [],
  frequentlyLikedTerms: Set<string> = new Set()
): React.ReactNode {
  if (!highlightedTerms || highlightedTerms.length === 0) {
    return lyrics;
  }

  // Filter and sort terms by length (longest first) to handle overlapping matches correctly
  // Don't trim terms - preserve original spacing for accurate matching
  const sortedTerms = [...highlightedTerms]
    .filter(term => term && typeof term === 'string' && term.length > 0)
    .sort((a, b) => b.length - a.length);
  
  if (sortedTerms.length === 0) {
    return lyrics;
  }
  
  // Create a regex pattern that matches any of the terms (case-insensitive)
  // Build pattern: match terms as they appear in lyrics with flexibility for quotes and spacing
  const patternParts = sortedTerms.map(term => {
    // 1. Escape special regex characters
    // Note: We don't escape quotes here as we handle them specifically below
    let escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // 2. Allow flexibility for whitespace (match newlines or multiple spaces)
    escaped = escaped.replace(/\s+/g, '[\\s\\n]+');
    
    // 3. Allow flexibility for quotes (straight vs curly)
    escaped = escaped.replace(/['’]/g, "['’]");
    
    // 4. Handle word boundaries
    // Only enforce word boundaries if the term starts/ends with a word character
    const isSingleWord = term.trim().split(/\s+/).length === 1;
    
    if (isSingleWord) {
      const startsWithWordChar = /^\w/.test(term.trim());
      const endsWithWordChar = /\w$/.test(term.trim());
      
      const startBoundary = startsWithWordChar ? '\\b' : '';
      const endBoundary = endsWithWordChar ? '\\b' : '';
      
      return `${startBoundary}${escaped}${endBoundary}`;
    }
    
    return escaped;
  });
  
  // Create pattern with case-insensitive flag
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
    
    // Check if this term is frequently liked (case-insensitive)
    const matchedTextLower = matchedText.toLowerCase().trim();
    const isFrequentlyLiked = frequentlyLikedTerms.has(matchedTextLower);
    
    // Use red color (#ef4444) for frequently liked terms, yellowish (#F3E2A0) for others to match avatar theme
    const highlightColor = isFrequentlyLiked ? "#ef4444" : "#F3E2A0";
    // Use white text for dark backgrounds (red), black text for light backgrounds (yellow)
    const textColor = isFrequentlyLiked ? "text-white" : "text-black font-medium";
    
    parts.push(
      <Highlighter
        key={`highlight-${match.index}-${keyCounter++}`}
        action="highlight"
        color={highlightColor}
        strokeWidth={2.5}
        animationDuration={600}
        iterations={2}
        padding={2}
        multiline={true}
        isView={false}
      >
        <span className={textColor}>{matchedText}</span>
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

