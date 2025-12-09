"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  User, TrendingUp, Activity, Zap, MoreHorizontal
} from "lucide-react";
import clsx from "clsx";
import Loader from "@/components/kokonutui/loader";

interface LikedTrack {
  id: number;
  track_id: string;
  track_name: string;
  track_artist: string;
  track_image_url: string | null;
  created_at: string | null;
}

interface ChatMessage {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

export function DashboardTab() {
  const [likedTracks, setLikedTracks] = useState<LikedTrack[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Note: Removed auto-scroll - user should maintain their scroll position

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tracksRes, chatRes] = await Promise.all([
          fetch('/api/liked-tracks-full'),
          fetch('/api/chat-history?limit=100')
        ]);

        if (tracksRes.ok) {
          const data = await tracksRes.json();
          setLikedTracks(data);
        }

        if (chatRes.ok) {
          const data = await chatRes.json();
          if (data.messages) {
            setChatHistory(data.messages);
          }
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const totalLiked = likedTracks.length;

    // Top 5 Artists Logic
    const artistCounts: Record<string, { count: number, image: string | null }> = {};
    likedTracks.forEach(track => {
      if (!artistCounts[track.track_artist]) {
        artistCounts[track.track_artist] = { count: 0, image: track.track_image_url };
      }
      artistCounts[track.track_artist].count++;
    });

    const topArtists = Object.entries(artistCounts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top Terms Logic
    const termCounts: Record<string, number> = {};
    const stopWords = new Set(['the', 'a', 'an', 'feat', 'remix', 'edit', 'mix', 'radio', 'check', 'for', 'and', 'my', 'to', 'in', 'on', 'of', '-', '&', 'with', 'from']);

    likedTracks.forEach(track => {
      const words = `${track.track_name} ${track.track_artist}`.toLowerCase().split(/[\s\(\)\[\]]+/);
      words.forEach(word => {
        const cleanWord = word.replace(/[^a-z0-9]/g, '');
        if (cleanWord.length > 2 && !stopWords.has(cleanWord)) {
          termCounts[cleanWord] = (termCounts[cleanWord] || 0) + 1;
        }
      });
    });

    const topTerms = Object.entries(termCounts)
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Daily Stats Logic
    const today = new Date();
    const isSameDay = (dateStr: string | null) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();
    };

    const todaysPrompts = chatHistory.filter(m => m.role === 'user' && isSameDay(m.created_at));
    const todaysLikes = likedTracks.filter(t => isSameDay(t.created_at));

    return {
      totalLiked,
      topArtists,
      topTerms,
      vibeScore: Math.min(100, Math.round(likedTracks.length * 1.5) + 50),
      todaysStats: {
        promptCount: todaysPrompts.length,
        prompts: todaysPrompts.map(p => p.content),
        likeCount: todaysLikes.length
      }
    };
  }, [likedTracks, chatHistory]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-transparent">
        <Loader
          title="Loading dashboard..."
          subtitle="Fetching your data"
          size="lg"
          className="text-white"
        />
      </div>
    );
  }

  // Generate 31 days for calendar
  const currentDay = new Date().getDate();

  return (
    <div ref={scrollContainerRef} className="h-full w-full overflow-y-auto bg-transparent text-white p-4 md:p-8 font-sans flex flex-col lg:flex-row gap-8">

      {/* LEFT MAIN DASHBOARD */}
      <div className="flex-1 space-y-8">
        {/* Header - Cleaned up */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light tracking-wide text-white">My Dashboard</h1>
          </div>
          {/* Removed Manage Button */}
        </div>

        {/* Top Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* Circular Gauge (Vibe Score) */}
          <div className="md:col-span-3 bg-[#242427] rounded-[24px] p-4 flex items-center justify-center relative overflow-hidden">
            <div className="relative w-28 h-28">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="56" cy="56" r="48" stroke="#333" strokeWidth="6" fill="transparent" />
                <circle
                  cx="56" cy="56" r="48"
                  stroke="#4ade80"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 48}
                  strokeDashoffset={2 * Math.PI * 48 * (1 - stats.vibeScore / 100)}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold">{stats.vibeScore}%</span>
                <span className="text-[10px] text-gray-400">Vibe Match</span>
              </div>
            </div>
          </div>

          {/* Yellow Stat Card (Liked Songs) */}
          <div className="md:col-span-3 bg-[#fcd34d] text-black rounded-[24px] p-6 flex flex-col items-center justify-center text-center">
            <div className="text-4xl font-bold mb-1">{stats.totalLiked}</div>
            <div className="text-sm font-semibold opacity-80">Liked Songs</div>
          </div>

          {/* Graph Card */}
          <div className="md:col-span-4 bg-[#242427] rounded-[24px] p-6 relative overflow-hidden flex flex-col justify-between">
            <div className="flex justify-between items-start z-10">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Weekly Activity</div>
                <div className="text-2xl font-bold">$Listening</div>
              </div>
              <div className="p-2 bg-green-500/20 rounded-full text-green-400">
                <Activity size={16} />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-16 opacity-30">
              <svg className="w-full h-full" preserveAspectRatio="none">
                <path d="M0,50 Q40,20 80,40 T160,30 T240,50 T320,20 L320,100 L0,100 Z" fill="#4ade80" />
                <path d="M0,50 Q40,20 80,40 T160,30 T240,50 T320,20" stroke="#4ade80" strokeWidth="2" fill="none" />
              </svg>
            </div>
          </div>

          {/* Small Terms Card */}
          <div className="md:col-span-2 bg-[#2d2d30] rounded-[24px] p-4 flex flex-col justify-between">
            <div className="text-xs text-gray-400">Top Term</div>
            <div className="text-lg font-bold text-green-400 capitalize truncate">
              {stats.topTerms[0]?.term || "N/A"}
            </div>
            <div className="text-[10px] text-gray-500">
              {stats.topTerms[0]?.count || 0} hits
            </div>
          </div>
        </div>

        {/* Middle Row (Green Card + Stats) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* Green "Credit Card" Style */}
          <div className="md:col-span-4 bg-[#86efac] text-black rounded-[24px] p-6 flex flex-col justify-between h-48 relative overflow-hidden">
            <div className="z-10 flex justify-between items-start">
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center">
                  <div className="w-3 h-3 bg-black rounded-full"></div>
                </div>
                <div className="w-6 h-6 rounded-full bg-white/50 -ml-2"></div>
              </div>
              <MoreHorizontal size={20} className="opacity-50" />
            </div>

            <div className="z-10 mt-auto">
              <div className="text-2xl font-mono tracking-widest mb-2 font-bold">**** 8842</div>
              <div className="text-[10px] uppercase font-bold opacity-60 tracking-widest">MUSIFY MEMBER</div>
            </div>

            <div className="absolute top-0 right-0 w-32 h-32 border-[20px] border-black/5 rounded-full -mr-10 -mt-10"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 border-[2px] border-black/5 rounded-full -ml-10 -mb-5"></div>
          </div>

          {/* "Today's Earning" -> Activity/Terms Graph */}
          <div className="md:col-span-5 bg-[#242427] rounded-[24px] p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <div className="text-2xl font-bold">{stats.topTerms.length * 4}</div>
                <div className="text-xs text-gray-400">Keywords Identified</div>
              </div>
              <div className="w-8 h-8 bg-[#333] rounded-full flex items-center justify-center text-green-400">
                <Zap size={16} />
              </div>
            </div>
            <div className="flex items-end gap-3 h-20 opacity-80">
              {stats.topTerms.map((t, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end items-center group">
                  <div className="w-full bg-[#333] rounded-t-sm group-hover:bg-green-400 transition-colors" style={{ height: `${(t.count / (stats.topTerms[0]?.count || 1)) * 100}%` }}></div>
                </div>
              ))}
              {[...Array(5 - stats.topTerms.length)].map((_, i) => (
                <div key={`empty-${i}`} className="flex-1 bg-[#333] h-2 rounded-t-sm"></div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-gray-500 font-mono">
              {stats.topTerms.slice(0, 3).map((t, i) => <span key={i}>{t.term.slice(0, 4)}</span>)}
            </div>
          </div>

          {/* Purple Card */}
          <div className="md:col-span-3 bg-[#8b5cf6] text-white rounded-[24px] p-6 flex flex-col justify-between">
            <div>
              <div className="text-xs opacity-70 mb-1">Top Genre</div>
              <div className="font-bold">Electronic</div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full bg-white/20 border border-purple-500"></div>
                <div className="w-6 h-6 rounded-full bg-white/40 border border-purple-500"></div>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">
                <TrendingUp size={12} />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Active Bookings -> Top Artists */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-light">Top Artists</h2>
            {/* Removed View All Button */}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {stats.topArtists.slice(0, 2).map((artist, i) => (
              <div key={i} className="bg-[#242427] rounded-[24px] p-6 flex items-center justify-between group hover:bg-[#2a2a2d] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-black/50 border border-white/10">
                    {artist.image ? (
                      <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500"><User size={20} /></div>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-white group-hover:text-green-400 transition-colors">{artist.name}</div>
                    <div className="text-xs text-gray-500 flex gap-2 mt-1">
                      <span className="px-2 py-0.5 bg-[#333] rounded text-gray-400">Artist</span>
                      <span className="px-2 py-0.5 bg-[#333] rounded text-gray-400">{artist.count} likes</span>
                    </div>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full p-1 flex items-center ${i === 0 ? 'bg-green-500 justify-end' : 'bg-[#333] justify-start'}`}>
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm"></div>
                </div>
              </div>
            ))}
            {stats.topArtists.length === 0 && (
              <div className="col-span-2 text-center py-10 text-gray-500 italic">Play some music to see your top artists here!</div>
            )}
          </div>
        </div>

      </div>

      {/* RIGHT SIDEBAR (Calendar / Timeline) */}
      <div className="w-full lg:w-80 bg-[#1e1e24] rounded-[32px] p-6 flex flex-col h-fit">
        {/* Date Header */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-1">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'long' })}</h2>
          <div className="text-sm text-gray-400">Today&apos;s Summary</div>
        </div>

        {/* 31 Day Calendar Grid */}
        <div className="grid grid-cols-7 text-center text-xs gap-y-4 mb-8 text-gray-400">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="font-medium">{d}</div>)}

          {Array.from({ length: 31 }).map((_, i) => {
            const day = i + 1;
            const isToday = day === currentDay;

            return (
              <div key={i} className="flex items-center justify-center">
                <span
                  className={clsx(
                    "w-7 h-7 flex items-center justify-center rounded-full transition-all text-[11px]",
                    isToday ? "bg-green-400 text-black font-bold" : "hover:text-white"
                  )}
                >
                  {day}
                </span>
              </div>
            )
          })}
        </div>

        <div className="h-px bg-white/10 mb-8 w-full"></div>

        {/* Timeline Tracking (D, B, W) */}
        <div className="space-y-6">
          <TimelineItem
            time={`${stats.todaysStats.promptCount} Requests`}
            title="Recommendations Asked"
            subtitle="Total prompts sent today"
            color="bg-[#8b5cf6]"
            initial="D"
          />

          <TimelineItem
            time={stats.todaysStats.prompts.length > 0 ? "Latest Vibe" : "No Activity"}
            title="Latest Prompt"
            subtitle={stats.todaysStats.prompts[stats.todaysStats.prompts.length - 1] || "Start chatting..."}
            color="bg-[#86efac] text-black"
            initial="B"
            isActive
          />

          <TimelineItem
            time={`${stats.todaysStats.likeCount} New Likes`}
            title="Liked Songs Today"
            subtitle="Added to your favorites"
            color="bg-[#fcd34d] text-black"
            initial="W"
          />
        </div>
      </div>

    </div>
  );
}

interface TimelineItemProps {
  time: string;
  title: string;
  subtitle: string;
  color: string;
  initial: string;
  isActive?: boolean;
}

function TimelineItem({ time, title, subtitle, color, initial, isActive }: TimelineItemProps) {
  return (
    <div className="relative pl-6 border-l border-dashed border-gray-700 pb-2 last:border-0 last:pb-0">
      <div className={`absolute top-0 left-[-5px] w-2.5 h-2.5 rounded-full ${isActive ? 'bg-white' : 'bg-gray-600'} border-2 border-[#1e1e24]`}></div>

      <div className={`rounded-[16px] p-4 ${color} mb-2 relative group cursor-pointer hover:brightness-110 transition-all`}>
        {isActive && (
          <div className="absolute left-[-26px] top-1/2 -translate-y-1/2 w-4 h-px bg-white"></div>
        )}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center font-bold text-xs shrink-0">
            {initial}
          </div>
          <div className="overflow-hidden">
            <div className="font-bold text-sm">{title}</div>
            <div className="text-[10px] opacity-70 mt-0.5 truncate max-w-[160px]">{subtitle}</div>
            <div className="text-[10px] font-mono mt-1 opacity-50">{time}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
