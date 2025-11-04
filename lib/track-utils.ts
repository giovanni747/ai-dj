/**
 * Utility functions for working with Spotify tracks
 */

import type { SpotifyTrack } from "@/types";

/**
 * Convert tracks array to CSV format
 */
export function tracksToCSV(tracks: SpotifyTrack[]): string {
  const headers = [
    "Position",
    "Track Name",
    "Artist",
    "Album",
    "Duration (ms)",
    "Popularity",
    "Spotify URL",
    "Preview URL",
  ];

  const rows = tracks.map((track) => [
    track.position.toString(),
    `"${track.name.replace(/"/g, '""')}"`, // Escape quotes
    `"${track.artist.replace(/"/g, '""')}"`,
    `"${track.album.name.replace(/"/g, '""')}"`,
    track.duration_ms.toString(),
    track.popularity.toString(),
    track.external_url,
    track.preview_url || "N/A",
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

/**
 * Download tracks as CSV file
 */
export function downloadTracksAsCSV(
  tracks: SpotifyTrack[],
  filename: string = "playlist.csv"
): void {
  const csv = tracksToCSV(tracks);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Format duration from milliseconds to MM:SS
 */
export function formatDuration(durationMs: number): string {
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Get album art URL (prefer medium size)
 */
export function getAlbumArt(
  images: { url: string }[],
  size: "small" | "medium" | "large" = "medium"
): string | null {
  if (!images || images.length === 0) return null;

  const sizeIndex = {
    small: images.length - 1,
    medium: Math.floor(images.length / 2),
    large: 0,
  };

  return images[sizeIndex[size]]?.url || images[0]?.url || null;
}

/**
 * Create a Spotify playlist URI from track IDs
 */
export function createPlaylistURI(trackIds: string[]): string {
  return trackIds.map((id) => `spotify:track:${id}`).join(",");
}

/**
 * Validate if a track object is complete
 */
export function isValidTrack(track: any): track is SpotifyTrack {
  return (
    track &&
    typeof track.position === "number" &&
    typeof track.id === "string" &&
    typeof track.name === "string" &&
    typeof track.artist === "string" &&
    Array.isArray(track.artists) &&
    track.album &&
    typeof track.album.name === "string" &&
    typeof track.external_url === "string" &&
    typeof track.duration_ms === "number" &&
    typeof track.popularity === "number"
  );
}

