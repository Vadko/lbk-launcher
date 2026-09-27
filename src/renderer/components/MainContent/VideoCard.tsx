import { Play } from 'lucide-react';
import React from 'react';
import LiteYouTubeEmbed from 'react-lite-youtube-embed';
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css';

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
      <div className="glass-card-no-motion">
        <h3 className="text-lg font-head font-semibold text-text-main mb-3">Відео</h3>
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-gamepad-action="true"
          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-color-accent/20 to-color-main/20 border border-color-accent/30 hover:border-color-accent/60 transition-all duration-300 text-white hover:shadow-[0_0_20px_rgba(255,164,122,0.3)]"
        >
          <Play size={20} className="text-color-accent" />
          <span className="font-medium">Переглянути відео</span>
        </a>
      </div>
    );
  }

  return (
    <div className="glass-card-no-motion">
      <h3 className="text-lg font-head font-semibold text-text-main mb-3">
        Трейлер українізації
      </h3>
      <div className="max-w-3xl mx-auto">
        <div className="rounded-lg overflow-hidden">
          <LiteYouTubeEmbed
            id={videoId}
            title="Трейлер українізації"
            announce="Відтворити"
            poster="hqdefault"
            cookie={false}
          />
        </div>
      </div>
    </div>
  );
};
