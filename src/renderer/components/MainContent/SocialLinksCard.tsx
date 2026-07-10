import { Book, Globe, Send } from 'lucide-react';
import React from 'react';
import type { Game } from '../../types/game';
import {
  DiscordIcon,
  EpicIcon,
  GOGIcon,
  SteamIcon,
  XboxIcon,
  XIcon,
  YouTubeIcon,
} from '../Icons/BrandIcons';

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
  type: 'steam' | 'gog' | 'epic-store' | 'xbox';
  appId?: number | string;
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
    data-gamepad-action="true"
  >
    {icon && (
      <div className={`${color} group-hover:brightness-125 transition-all duration-300`}>
        {icon}
      </div>
    )}
    {label && <span className="text-sm text-text-main font-medium">{label}</span>}
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
          label: 'Steam',
          hoverColor: 'hover:border-[#A2D2F6]/60 hover:shadow-[#A2D2F6]/20',
          color: 'text-[#A2D2F6]',
        };
      case 'gog':
        return {
          url,
          icon: <GOGIcon size={18} />,
          title: 'GOG Galaxy',
          label: 'GOG Galaxy',
          hoverColor: 'hover:border-[#86328A]/60 hover:shadow-[#86328A]/20',
          color: 'text-[#86328A]',
        };
      case 'epic-store':
        return {
          url,
          icon: <EpicIcon size={18} />,
          title: 'Epic Games',
          label: 'Epic Games',
          hoverColor: 'hover:border-[#ffffff]/60 hover:shadow-[#ffffff]/20',
          color: 'text-[#ffffff]',
        };
      case 'xbox':
        return {
          url,
          icon: <XboxIcon size={18} />,
          title: 'Microsoft Store',
          label: 'Microsoft Store',
          hoverColor: 'hover:border-[#107C10]/60 hover:shadow-[#107C10]/20',
          color: 'text-[#107C10]',
        };
    }
  };

  const config = getStoreConfig();

  return (
    <a
      data-nav-group="main-links"
      data-gamepad-action="true"
      className={`group flex items-center gap-2 px-4 py-2 rounded-lg bg-glass hover:bg-glass-hover border border-border ${config.hoverColor} hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 ease-out`}
      title={`Відкрити в ${config.title}`}
      href={config.url}
      target="_blank"
    >
      {config.icon && (
        <div
          className={`${config.color} group-hover:brightness-125 transition-all duration-200 ease-out`}
        >
          {config.icon}
        </div>
      )}
      {config.label && (
        <span className="text-sm text-text-main font-medium">{config.label}</span>
      )}
    </a>
  );
};

export const SocialLinksCard: React.FC<SocialLinksCardProps> = ({ game }) => {
  const links = [
    game.website && {
      icon: game.website.includes('steamcommunity.com/sharedfiles/filedetails') ? (
        <Book size={18} />
      ) : (
        <Globe size={18} />
      ),
      label: game.website.includes('steamcommunity.com/sharedfiles/filedetails')
        ? 'Steam посібник'
        : 'Вебсайт',
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
      icon: <YouTubeIcon size={18} />,
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
    game.gog_store_url && {
      type: 'gog',
      url: game.gog_store_url,
    },
    game.epic_store_url && {
      type: 'epic-store',
      url: game.epic_store_url,
    },
    game.xbox_store_url && {
      type: 'xbox',
      url: game.xbox_store_url,
    },
  ].filter(Boolean) as StoreLinkProps[];

  if (links.length === 0 && stores.length === 0) {
    return null;
  }

  return (
    (stores.length > 0 || links.length > 0) && (
      <div className="glass-card-no-motion">
        <h3 className="text-lg font-head font-semibold text-text-main mb-4">Посилання</h3>
        {stores.length > 0 && (
          <>
            <p className="text-base font-head font-semibold text-text-muted mb-2">
              Крамниці
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              {stores.map((link, index) => (
                <StoreButton key={index} {...link} />
              ))}
            </div>
          </>
        )}

        {links.length > 0 && (
          <>
            <p className="text-base font-head font-semibold text-text-muted mb-2">Інше</p>
            <div className="flex flex-wrap items-center gap-3">
              {links.length > 0 && game.steam_app_id && (
                <div className="hidden sm:block w-0 h-10 border-l border-border-hover" />
              )}
              {links.map((link, index) => (
                <SocialLink key={index} {...link} />
              ))}
            </div>
          </>
        )}
      </div>
    )
  );
};
