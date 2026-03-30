import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { DiscordIcon } from '../Icons/DiscordIcon';
import { SignalIcon } from '../Icons/SignalIcon';
import { TelegramIcon } from '../Icons/TelegramIcon';
import { ThreadsIcon } from '../Icons/ThreadsIcon';
import { ViberIcon } from '../Icons/ViberIcon';
import { XIcon } from '../Icons/XIcon';
import { YouTubeIcon } from '../Icons/YouTubeIcon';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameSlug: string;
  teamSlug: string;
  gameName: string;
  teamName: string;
}

interface SocialPlatform {
  key: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  getShareUrl: (shareUrl: string, shareText: string) => string;
}

const createSocialPlatforms = (): SocialPlatform[] => [
  {
    key: 'telegram',
    name: 'Telegram',
    icon: <TelegramIcon size={24} />,
    color: 'text-[#0088cc] hover:bg-[#0088cc]/20',
    getShareUrl: (shareUrl, shareText) =>
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}&type=custom_url&app_absent=0`,
  },
  {
    key: 'viber',
    name: 'Viber',
    icon: <ViberIcon size={24} />,
    color: 'text-[#7360f2] hover:bg-[#7360f2]/20',
    getShareUrl: (shareUrl, shareText) =>
      `viber://forward?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
  },
  {
    key: 'discord',
    name: 'Discord',
    icon: <DiscordIcon size={24} />,
    color: 'text-[#5865F2] hover:bg-[#5865F2]/20',
    // Discord doesn't have a direct share URL, just opens DMs
    getShareUrl: (shareUrl, shareText) =>
      `https://discord.com/channels/@me?message=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
  },
  {
    key: 'youtube',
    name: 'YouTube',
    icon: <YouTubeIcon size={24} />,
    color: 'text-[#FF0000] hover:bg-[#FF0000]/20',
    // YouTube Community post
    getShareUrl: (shareUrl, shareText) =>
      `https://www.youtube.com/post_create?content=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
  },
  {
    key: 'signal',
    name: 'Signal',
    icon: <SignalIcon size={24} />,
    color: 'text-[#3a76f0] hover:bg-[#3a76f0]/20',
    getShareUrl: (shareUrl, shareText) =>
      `https://signal.me/#p/${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
  },
  {
    key: 'threads',
    name: 'Threads',
    icon: <ThreadsIcon size={24} />,
    color: 'text-white hover:bg-white/20',
    getShareUrl: (shareUrl, shareText) =>
      `https://www.threads.net/intent/post?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
  },
  {
    key: 'x',
    name: 'X',
    icon: <XIcon size={24} />,
    color: 'text-white hover:bg-white/20',
    getShareUrl: (shareUrl, shareText) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
  },
];

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  gameSlug,
  teamSlug,
  gameName,
  teamName,
}) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = `https://lbklauncher.com/open/${gameSlug}/${teamSlug}`;
  const shareText = `${gameName} з українською локалізацією від ${teamName} можна зручно встановити у LBK Launcher`;
  const socialPlatforms = createSocialPlatforms();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = (platform: SocialPlatform) => {
    const url = platform.getShareUrl(shareUrl, shareText);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={onClose}
        >
          {/* Backdrop with blur */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-xl modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          />

          {/* Modal content */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
            className="relative max-w-[480px] w-full mx-4 bg-[rgba(10,20,30,0.95)] border border-border rounded-2xl shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{
              duration: 0.2,
              ease: [0.23, 1, 0.32, 1],
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3
                id="share-modal-title"
                className="text-lg font-semibold text-text-main"
              >
                Поширити
              </h3>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-glass-hover transition-colors"
              >
                <X size={18} className="text-text-muted" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Social platforms */}
              <div>
                <p className="text-sm text-text-muted mb-4">Поділитися в:</p>
                <div className="flex flex-wrap gap-3">
                  {socialPlatforms.map((platform) => (
                    <button
                      key={platform.key}
                      onClick={() => handleShare(platform)}
                      className={`w-12 h-12 flex items-center justify-center rounded-xl bg-glass border border-border hover:border-border-hover transition-all duration-200 ${platform.color}`}
                      title={platform.name}
                    >
                      {platform.icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Copy link */}
              <div>
                <p className="text-sm text-text-muted mb-3">Або скопіюйте посилання:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-4 py-3 bg-glass border border-border rounded-xl text-sm text-text-main focus:outline-none focus:border-border-hover cursor-text"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={handleCopy}
                    className={`px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2 min-w-[140px] justify-center ${
                      copied
                        ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                        : 'bg-neon-purple/20 text-neon-purple border border-neon-purple/40 hover:bg-neon-purple/30'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check size={18} />
                        Скопійовано!
                      </>
                    ) : (
                      <>
                        <Copy size={18} />
                        Копіювати
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
