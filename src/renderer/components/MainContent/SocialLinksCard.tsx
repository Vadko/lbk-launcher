import React from 'react';
import { Game } from '../../types/game';
import { Globe, Send, Youtube } from 'lucide-react';
import { XIcon } from '../Icons/XIcon';
import { DiscordIcon } from '../Icons/DiscordIcon';
import { SteamIcon } from '../Icons/SteamIcon';

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
      <span className="text-sm text-white font-medium">{label}</span>
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
      className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#1b2838] to-[#2a475e] hover:from-[#2a475e] hover:to-[#3d6a8a] border border-[#66c0f4]/30 hover:border-[#66c0f4]/60 transition-all duration-300"
      title="Відкрити в Steam Store"
    >
      <SteamIcon
        size={18}
        className="text-[#66c0f4] group-hover:text-white transition-colors duration-300"
      />
      <span className="text-sm text-white font-medium">Steam Store</span>
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

  if (links.length === 0 && !game.steam_app_id) {
    return null;
  }

  return (
    <div className="glass-card">
      <h3 className="text-lg font-head font-semibold text-white mb-4">Посилання</h3>
      <div className="flex flex-wrap items-center gap-3">
        {game.steam_app_id && <SteamStoreButton steamAppId={game.steam_app_id} />}
        {links.length > 0 && game.steam_app_id && (
          <div className="hidden sm:block w-px h-10 bg-white/20" />
        )}
        {links.map((link, index) => (
          <SocialLink key={index} {...link} />
        ))}
      </div>
    </div>
  );
};
