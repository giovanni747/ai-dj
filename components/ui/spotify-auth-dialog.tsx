"use client";

import { Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SpotifyAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SpotifyAuthDialog = ({ open, onOpenChange }: SpotifyAuthDialogProps) => {
  const handleSpotifyLogin = () => {
    // Store current URL to return after auth
    localStorage.setItem('return_url', window.location.href);
    
    // Open Spotify OAuth in same window
    // After auth, Flask will redirect back to Next.js
    window.location.href = 'http://127.0.0.1:5001/';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="bg-[#1DB954] text-white rounded-full p-3">
              <Music className="h-6 w-6" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            Connect to Spotify
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Sign in with Spotify to get personalized music recommendations from your AI DJ. We only access your music preferences to provide better suggestions.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <Button
            onClick={handleSpotifyLogin}
            className="w-full h-12 bg-[#1DB954] hover:bg-[#1ed760] text-white font-semibold"
          >
            <Music className="mr-2 h-5 w-5" />
            Continue with Spotify
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Your privacy is important. We only access your music preferences.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
