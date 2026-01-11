import { Globe, Send, Youtube } from 'lucide-react';
import React from 'react';
import type { Game } from '../../types/game';
import { DiscordIcon } from '../Icons/DiscordIcon';
import { EpicIcon } from '../Icons/EpicIcon';
import { GOGIcon } from '../Icons/GOGIcon';
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

interface StoreLinkProps {
  type: 'steam' | 'gog' | 'epic-store';
  appId: number | string;
  url?: string;
}

const SocialLink: React.FC<SocialLinkProps> = ({ icon, label, url, color }) => (
  <a
    data-nav-group="main-links"
    className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-glass hover:bg-glass-hover border border-border hover:border-border-hover transition-all duration-300"
    title={label}
    target="_blank"
    href={url}
    rel="noopener noreferrer"
  >
    <div className={`${color} group-hover:brightness-125 transition-all duration-300`}>
      {icon}
    </div>
    <span className="text-sm text-text-main font-medium">{label}</span>
  </a>
);

const StoreButton: React.FC<StoreLinkProps> = ({ type = 'steam', appId, url }) => {
  const getStoreConfig = () => {
    switch (type) {
      case 'steam':
        return {
          url: `steam://store/${appId}`,
          icon: <SteamIcon size={18} />,
          title: 'Steam Store',
          label: 'Крамниця Steam',
          hoverColor: 'hover:border-[#A2D2F6]/60 hover:shadow-[#A2D2F6]/20',
          color: 'text-[#A2D2F6]',
        };
      case 'gog':
        return {
          url: url ?? `https://www.gog.com/game/${appId}`,
          icon: <GOGIcon size={18} />,
          title: 'GOG Galaxy',
          label: 'Крамниця GOG Galaxy',
          hoverColor: 'hover:border-[#7c3aed]/60 hover:shadow-[#7c3aed]/20',
          color: 'text-[#7c3aed]',
        };
      case 'epic-store':
        return {
          url: `com.epicgames.launcher://store/product/${appId}`,
          icon: <EpicIcon size={18} />,
          title: 'Epic Games',
          label: 'Крамниця Epic Games',
          hoverColor: 'hover:border-[#0078f3]/60 hover:shadow-[#0078f3]/20',
          color: 'text-[#0078f3]',
        };
    }
  };

  const config = getStoreConfig();

  return (
    <a
      data-nav-group="main-links"
      className={`group flex items-center gap-2 px-4 py-2 rounded-lg bg-glass hover:bg-glass-hover border border-border ${config.hoverColor} hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 ease-out`}
      title={`Відкрити в ${config.title}`}
      href={config.url}
      target="_blank"
    >
      <div
        className={`${config.color} group-hover:brightness-125 transition-all duration-200 ease-out`}
      >
        {config.icon}
      </div>
      <span className="text-sm text-text-main font-medium">{config.label}</span>
    </a>
  );
};

export const SocialLinksCard: React.FC<SocialLinksCardProps> = ({ game }) => {
  const links = [
    game.website && {
      icon: <Globe size={18} />,
      label: 'Вебсайт',
      url: game.website,
      color: 'text-color-accent',
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

  const stores = [
    game.steam_app_id && {
      type: 'steam',
      appId: game.steam_app_id,
    },
    // game.gog_id && {
    //   type: 'gog',
    //   appId: game.gog_id,
    //   url: game.gog_url,
    // },
    // game.epic_app_id && {
    //   type: 'epic-store',
    //   appId: game.epic_app_id,
    // },
  ].filter(Boolean) as StoreLinkProps[];

  if (links.length === 0 && stores.length === 0) {
    return null;
  }

  return (
    <div className="glass-card">
      <h3 className="text-lg font-head font-semibold text-text-main mb-4">Посилання</h3>
      <div className="flex flex-wrap items-center gap-3">
        {stores.map((link, index) => (
          <StoreButton key={index} {...link} />
        ))}
        {links.length > 0 && game.steam_app_id && (
          <div className="hidden sm:block w-0 h-10 border-l border-border-hover" />
        )}
        {links.map((link, index) => (
          <SocialLink key={index} {...link} />
        ))}
      </div>
    </div>
  );
};
