import { BookIcon, GlobeIcon, SendIcon } from 'lucide-react';
import React from 'react';
import { t } from '@/shared/i18n/i18n';
import { steamStoreUrl } from '@/shared/steam-urls';
import type { Game, LinkApp } from '../../../shared/types';
import {
  DiscordIcon,
  EAIcon,
  EpicIcon,
  GitHubIcon,
  GOGIcon,
  PatreonIcon,
  SteamIcon,
  UbisoftIcon,
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
  open: () => Promise<unknown>;
  color: string;
}

type StoreLinkProps =
  | { type: 'steam'; appId: number }
  | { type: 'gog' | 'epic-store' | 'xbox' | 'uplay' | 'ea'; url: string };

const SocialLink: React.FC<SocialLinkProps> = ({ icon, label, open, color }) => (
  <button
    type="button"
    data-nav-group="main-links"
    className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-glass hover:bg-glass-hover border border-border hover:border-border-hover transition-all duration-300"
    title={label}
    onClick={() => void open()}
    data-gamepad-action="true"
  >
    {icon && (
      <div className={`${color} group-hover:brightness-125 transition-all duration-300`}>
        {icon}
      </div>
    )}
    {label && <span className="text-sm text-text-main font-medium">{label}</span>}
  </button>
);

const StoreButton: React.FC<StoreLinkProps> = (props) => {
  const getStoreConfig = () => {
    switch (props.type) {
      case 'steam':
        return {
          open: () => window.electronAPI.openAppLink('steam', steamStoreUrl(props.appId)),
          icon: <SteamIcon size={18} />,
          title: 'Steam Store',
          label: 'Steam',
          hoverColor: 'hover:border-[#A2D2F6]/60 hover:shadow-[#A2D2F6]/20',
          color: 'text-[#A2D2F6]',
        };
      case 'gog':
        return {
          open: () => window.electronAPI.openExternal(props.url),
          icon: <GOGIcon size={18} />,
          title: 'GOG Galaxy',
          label: 'GOG Galaxy',
          hoverColor: 'hover:border-[#86328A]/60 hover:shadow-[#86328A]/20',
          color: 'text-[#86328A]',
        };
      case 'epic-store':
        return {
          open: () => window.electronAPI.openExternal(props.url),
          icon: <EpicIcon size={18} />,
          title: 'Epic Games',
          label: 'Epic Games',
          hoverColor: 'hover:border-[#ffffff]/60 hover:shadow-[#ffffff]/20',
          color: 'text-[#ffffff]',
        };
      case 'xbox':
        return {
          open: () => window.electronAPI.openExternal(props.url),
          icon: <XboxIcon size={18} />,
          title: 'Microsoft Store',
          label: 'Microsoft Store',
          hoverColor: 'hover:border-[#107C10]/60 hover:shadow-[#107C10]/20',
          color: 'text-[#107C10]',
        };
      case 'uplay':
        return {
          open: () => window.electronAPI.openExternal(props.url),
          icon: <UbisoftIcon size={18} />,
          title: 'Ubisoft Store',
          label: 'Ubisoft Store',
          hoverColor: 'hover:border-[#0070FF]/60 hover:shadow-[#0070FF]/20',
          color: 'text-[#0070FF]',
        };
      case 'ea':
        return {
          open: () => window.electronAPI.openExternal(props.url),
          icon: <EAIcon size={18} />,
          title: 'EA App',
          label: 'EA App',
          hoverColor: 'hover:border-[#FF4747]/60 hover:shadow-[#FF4747]/20',
          color: 'text-[#FF4747]',
        };
    }
  };

  const config = getStoreConfig();

  return (
    <button
      type="button"
      data-nav-group="main-links"
      data-gamepad-action="true"
      className={`group flex items-center gap-2 px-4 py-2 rounded-lg bg-glass hover:bg-glass-hover border border-border ${config.hoverColor} hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 ease-out`}
      title={t('gameLinks.openIn', { store: config.title })}
      onClick={() => void config.open()}
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
    </button>
  );
};

const WEBSITE_KINDS: (Omit<SocialLinkProps, 'open'> & {
  match: string;
  app?: LinkApp;
})[] = [
  {
    match: 'steamcommunity.com/sharedfiles/filedetails',
    label: t('gameLinks.steamGuide'),
    color: 'text-color-accent',
    icon: <BookIcon size={18} />,
    app: 'steam',
  },
  {
    match: 'github.com',
    label: 'GitHub',
    color: 'text-text-main',
    icon: <GitHubIcon size={18} />,
  },
  {
    match: 'patreon.com',
    label: 'Patreon',
    color: 'text-[#FF424D]',
    icon: <PatreonIcon size={18} />,
  },
];

function describeWebsite(url: string): SocialLinkProps {
  const lowerUrl = url.toLowerCase();
  const kind = WEBSITE_KINDS.find((candidate) => lowerUrl.includes(candidate.match));
  const app = kind?.app;
  return {
    icon: kind?.icon ?? <GlobeIcon size={18} />,
    label: kind?.label ?? t('gameLinks.website'),
    color: kind?.color ?? 'text-color-accent',
    open: () =>
      app
        ? window.electronAPI.openAppLink(app, url)
        : window.electronAPI.openExternal(url),
  };
}

export const SocialLinksCard: React.FC<SocialLinksCardProps> = ({ game }) => {
  const { website, telegram, discord, twitter, youtube } = game;
  const links = [
    website && describeWebsite(website),
    telegram && {
      icon: <SendIcon size={18} />,
      label: 'Telegram',
      open: () => window.electronAPI.openAppLink('telegram', telegram),
      color: 'text-[#0088cc]',
    },
    discord && {
      icon: <DiscordIcon size={18} />,
      label: 'Discord',
      open: () => window.electronAPI.openAppLink('discord', discord),
      color: 'text-[#5865F2]',
    },
    twitter && {
      icon: <XIcon size={18} />,
      label: 'X',
      open: () => window.electronAPI.openExternal(twitter),
      color: 'text-black',
    },
    youtube && {
      icon: <YouTubeIcon size={18} />,
      label: 'YouTube',
      open: () => window.electronAPI.openExternal(youtube),
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
    game.uplay_store_url && {
      type: 'uplay',
      url: game.uplay_store_url,
    },
    game.ea_store_url && {
      type: 'ea',
      url: game.ea_store_url,
    },
  ].filter(Boolean) as StoreLinkProps[];

  if (links.length === 0 && stores.length === 0) {
    return null;
  }

  return (
    (stores.length > 0 || links.length > 0) && (
      <div className="glass-card-no-motion">
        <h3 className="text-lg font-head font-semibold text-text-main mb-4">
          {t('gameLinks.title')}
        </h3>
        {stores.length > 0 && (
          <>
            <p className="text-base font-head font-semibold text-text-muted mb-2">
              {t('gameLinks.stores')}
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
            <p className="text-base font-head font-semibold text-text-muted mb-2">
              {t('gameLinks.other')}
            </p>
            <div className="flex flex-wrap items-center gap-3">
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
