import { Check, Copy } from 'lucide-react';
import React, { useState } from 'react';
import { trackEvent } from '@/renderer/utils/analytics';
import { FacebookIcon } from '../Icons/FacebookIcon';
import { RedditIcon } from '../Icons/RedditIcon';
import { SignalIcon } from '../Icons/SignalIcon';
import { TelegramIcon } from '../Icons/TelegramIcon';
import { ThreadsIcon } from '../Icons/ThreadsIcon';
import { WhatsAppIcon } from '../Icons/WhatsAppIcon';
import { XIcon } from '../Icons/XIcon';
import { Button } from '../ui/Button';
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
    color: 'focus:text-[#0088cc] focus:bg-[#0088cc]/15 focus:border-[#0088cc]',
    getShareUrl: (shareUrl, shareText) =>
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}&type=custom_url&app_absent=0`,
  },
  {
    key: 'whatsapp',
    name: 'WhatsApp',
    icon: <WhatsAppIcon size={24} />,
    color: 'focus:text-[#25D366] focus:bg-[#25D366]/15 focus:border-[#25D366]',
    getShareUrl: (shareUrl, shareText) =>
      `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
  },
  {
    key: 'reddit',
    name: 'Reddit',
    icon: <RedditIcon size={24} />,
    color: 'focus:text-[#FF4500] focus:bg-[#FF4500]/15 focus:border-[#FF4500]',
    getShareUrl: (shareUrl, shareText) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`,
  },
  {
    key: 'facebook',
    name: 'Facebook',
    icon: <FacebookIcon size={24} />,
    color: 'focus:text-[#1877F2] focus:bg-[#1877F2]/15 focus:border-[#1877F2]',
    getShareUrl: (shareUrl, shareText) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`,
  },
  {
    key: 'signal',
    name: 'Signal',
    icon: <SignalIcon size={24} />,
    color: 'focus:text-[#3a76f0] focus:bg-[#3a76f0]/15 focus:border-[#3a76f0]',
    getShareUrl: (shareUrl, shareText) =>
      `https://signal.me/#p/${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
  },
  {
    key: 'threads',
    name: 'Threads',
    icon: <ThreadsIcon size={24} />,
    color: 'focus:text-white focus:bg-white/20 focus:border-white',
    getShareUrl: (shareUrl, shareText) =>
      `https://www.threads.net/intent/post?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
  },
  {
    key: 'x',
    name: 'X',
    icon: <XIcon size={24} />,
    color: 'focus:text-white focus:bg-white/20 focus:border-white',
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

  const handleCopy = () => {
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
  };

  const handleShare = (platform: SocialPlatform) => {
    const url = platform.getShareUrl(shareUrl, shareText);
    trackEvent('Share', {
      platform: platform.name,
      game: gameName,
      team: teamName,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Поширити"
      classNames="max-w-[514px]"
      usePortal
    >
      <div className="space-y-14">
        <div>
          <p className="text-sm text-text-muted mb-3">Поділитися в:</p>
          <div className="flex flex-wrap gap-3">
            {socialPlatforms.map((platform) => (
              <button
                key={platform.key}
                onClick={() => handleShare(platform)}
                className={`w-14 h-14 flex items-center justify-center rounded-xl bg-glass border border-border hover:border-border-hover transition-all duration-200 text-[#939296] hover:border-[#939296] hover:bg-white/15 ${platform.color}`}
                title={platform.name}
              >
                {platform.icon}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm text-text-muted mb-3">
            Або скопіюйте посилання чи текст:
          </p>
          <div className="flex gap-4">
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
