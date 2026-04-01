import { Check, Copy } from 'lucide-react';
import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { SignalIcon } from '../Icons/SignalIcon';
import { TelegramIcon } from '../Icons/TelegramIcon';
import { ThreadsIcon } from '../Icons/ThreadsIcon';
import { WhatsAppIcon } from '../Icons/WhatsAppIcon';
import { FacebookIcon } from '../Icons/FacebookIcon';
import { RedditIcon } from '../Icons/RedditIcon';
import { XIcon } from '../Icons/XIcon';
import { Modal } from './Modal';

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
    key: 'whatsapp',
    name: 'WhatsApp',
    icon: <WhatsAppIcon size={24} />,
    color: 'text-[#25D366] hover:bg-[#25D366]/20',
    getShareUrl: (shareUrl, shareText) =>
      `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
  },
  {
    key: 'reddit',
    name: 'Reddit',
    icon: <RedditIcon size={24} />,
    color: 'text-[#FF4500] hover:bg-[#FF4500]/20',
    // Reddit share URL
    getShareUrl: (shareUrl, shareText) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`,
  },
  {
    key: 'facebook',
    name: 'Facebook',
    icon: <FacebookIcon size={24} />,
    color: 'text-[#1877F2] hover:bg-[#1877F2]/20',
    // Facebook share URL
    getShareUrl: (shareUrl, shareText) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`,
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
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = `${shareText}\n${shareUrl}`;
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Поширити"
      classNames="w-[514px]"
      usePortal
    >
      <div className="space-y-6">
        {/* Social platforms */}
        <div>
          <p className="text-sm text-text-muted mb-4">Поділитися в:</p>
          <div className="flex flex-wrap gap-3">
            {socialPlatforms.map((platform) => (
              <button
                key={platform.key}
                onClick={() => handleShare(platform)}
                className={`w-14 h-14 flex items-center justify-center rounded-xl bg-glass border border-border hover:border-border-hover transition-all duration-200 ${platform.color}`}
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
            <Button
              onClick={handleCopy}
              variant={copied ? 'accent' : 'primary'}
              icon={copied ? <Check size={18} /> : <Copy size={18} />}
              className="min-w-[140px] !px-4 !py-3 !text-sm"
            >
              {copied ? 'Скопійовано!' : 'Копіювати текст'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
