import { Check, Globe, Send, Share2, Youtube } from 'lucide-react';
import React, { useState } from 'react';
import { teamToSlug } from '../../../shared/search-utils';
import type { Game } from '../../types/game';
import { DiscordIcon } from '../Icons/DiscordIcon';
import { SteamIcon } from '../Icons/SteamIcon';
import { XIcon } from '../Icons/XIcon';

interface SocialLinksCardProps {
  game: Game;
}

interface SocialLinkProps {
  icon: React.ReactNode;
  label: string;
  url: string;
  color: string;
}

const SocialLink: React.FC<SocialLinkProps> = ({ icon, label, url, color }) => {
  const handleClick = () => {
    if (window.electronAPI) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <button
      onClick={handleClick}
      data-nav-group="main-links"
      className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-glass hover:bg-glass-hover border border-border hover:border-border-hover transition-all duration-300"
      title={label}
    >
      <div className={`${color} group-hover:brightness-125 transition-all duration-300`}>
        {icon}
      </div>
      <span className="text-sm text-text-main font-medium">{label}</span>
    </button>
  );
};

const ShareButton: React.FC<{ game: Game }> = ({ game }) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (!game.slug || !game.team) return;

    const teamSlug = teamToSlug(game.team);
    const shareUrl = `https://lbklauncher.com/open/${game.slug}/${teamSlug}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
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

  if (!game.slug || !game.team) return null;

  return (
    <button
      onClick={handleShare}
      data-nav-group="main-links"
      className={`group flex items-center gap-2 px-4 py-2 rounded-lg bg-glass hover:bg-glass-hover border transition-all duration-300 ${
        copied
          ? 'border-green-500/60 text-green-400'
          : 'border-border hover:border-neon-purple/60'
      }`}
      title="Скопіювати посилання"
    >
      <div
        className={`transition-all duration-300 ${
          copied ? 'text-green-400' : 'text-neon-purple group-hover:brightness-125'
        }`}
      >
        {copied ? <Check size={18} /> : <Share2 size={18} />}
      </div>
      <span className="text-sm font-medium">
        {copied ? 'Скопійовано!' : 'Поділитись'}
      </span>
    </button>
  );
};

const SteamStoreButton: React.FC<{ steamAppId: number }> = ({ steamAppId }) => {
  const handleClick = () => {
    const url = `https://store.steampowered.com/app/${steamAppId}/`;
    if (window.electronAPI) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <button
      onClick={handleClick}
      data-nav-group="main-links"
      className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-glass hover:bg-glass-hover border border-border hover:border-[#66c0f4]/60 hover:shadow-lg hover:shadow-[#66c0f4]/20 transform hover:scale-[1.02] transition-all duration-200 ease-out"
      title="Відкрити в Steam Store"
    >
      <SteamIcon
        size={18}
        className="text-[#66c0f4] group-hover:brightness-125 transition-all duration-200 ease-out"
      />
      <span className="text-sm text-text-main font-medium">Крамниця Steam</span>
    </button>
  );
};

export const SocialLinksCard: React.FC<SocialLinksCardProps> = ({ game }) => {
  const links = [
    game.website && {
      icon: <Globe size={18} />,
      label: 'Вебсайт',
      url: game.website,
      color: 'text-neon-blue',
    },
    game.telegram && {
      icon: <Send size={18} />,
      label: 'Telegram',
      url: game.telegram,
      color: 'text-[#0088cc]',
    },
    game.discord && {
      icon: <DiscordIcon size={18} />,
      label: 'Discord',
      url: game.discord,
      color: 'text-[#5865F2]',
    },
    game.twitter && {
      icon: <XIcon size={18} />,
      label: 'X',
      url: game.twitter,
      color: 'text-black',
    },
    game.youtube && {
      icon: <Youtube size={18} />,
      label: 'YouTube',
      url: game.youtube,
      color: 'text-[#FF0000]',
    },
  ].filter(Boolean) as SocialLinkProps[];

  const hasShareButton = game.slug && game.team;

  if (links.length === 0 && !game.steam_app_id && !hasShareButton) {
    return null;
  }

  return (
    <div className="glass-card">
      <h3 className="text-lg font-head font-semibold text-text-main mb-4">Посилання</h3>
      <div className="flex flex-wrap items-center gap-3">
        {game.steam_app_id && <SteamStoreButton steamAppId={game.steam_app_id} />}
        <ShareButton game={game} />
        {links.length > 0 && (game.steam_app_id || hasShareButton) && (
          <div className="hidden sm:block w-0 h-10 border-l border-border-hover" />
        )}
        {links.map((link, index) => (
          <SocialLink key={index} {...link} />
        ))}
      </div>
    </div>
  );
};
