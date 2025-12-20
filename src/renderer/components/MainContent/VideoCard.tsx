import React from 'react';
import { Play } from 'lucide-react';

interface VideoCardProps {
  videoUrl: string;
}

/**
 * Extract YouTube video ID from various URL formats
 */
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export const VideoCard: React.FC<VideoCardProps> = ({ videoUrl }) => {
  const videoId = getYouTubeVideoId(videoUrl);

  if (!videoId) {
    // If not a YouTube URL or can't extract ID, show a button to open link
    return (
      <div className="glass-card">
        <h3 className="text-lg font-head font-semibold text-text-main mb-3">Відео</h3>
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-neon-blue/20 to-neon-purple/20 border border-neon-blue/30 hover:border-neon-blue/60 transition-all duration-300 text-white hover:shadow-[0_0_20px_rgba(0,242,255,0.3)]"
        >
          <Play size={20} className="text-neon-blue" />
          <span className="font-medium">Переглянути відео</span>
        </a>
      </div>
    );
  }

  // YouTube embed (using youtube-nocookie.com to avoid error 153)
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;

  return (
    <div className="glass-card">
      <h3 className="text-lg font-head font-semibold text-text-main mb-3">
        Трейлер українізації
      </h3>
      <div className="max-w-3xl mx-auto">
        <div
          className="relative rounded-lg overflow-hidden"
          style={{ paddingBottom: '56.25%' }}
        >
          <iframe
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute top-0 left-0 w-full h-full"
            src={embedUrl}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
};
