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
  // Escape special regex characters in terms, but preserve spaces
  const escapedTerms = sortedTerms.map(term => {
    // Preserve the original term but escape regex special chars
    return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  
  // Build pattern: match terms as they appear in lyrics
  // Use non-word-boundary approach for more flexible matching
  const patternParts = escapedTerms.map(term => {
    // Escape the term for regex
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // For single words, try with word boundaries first, but also allow partial matches
    if (term.trim().split(/\s+/).length === 1) {
      // Match as whole word, but be flexible with surrounding characters
      return `\\b${escaped}\\b`;
    }
    // For phrases, match exactly as written (preserving spaces)
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
    
    // Use red color (#ef4444) for frequently liked terms, cyan (#22d3ee) for others
    const highlightColor = isFrequentlyLiked ? "#ef4444" : "#22d3ee";
    
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

