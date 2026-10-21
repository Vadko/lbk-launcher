import {
  CalendarClockIcon,
  CheckCircle2Icon,
  HammerIcon,
  Mic2Icon,
  MonitorIcon,
  PackageIcon,
  TrophyIcon,
  UserIcon,
  WrenchIcon,
} from 'lucide-react';
import React from 'react';
import { AiIcon } from '../../Icons/AiIcon';
import { EpicIcon, GOGIcon, SteamIcon, XboxIcon } from '../../Icons/BrandIcons';
import { PencilIcon } from '../../Icons/PencilIcon';

export const STATUS_ICONS: Record<string, React.ReactNode> = {
  planned: <CalendarClockIcon size={14} />,
  'in-progress': <HammerIcon size={14} />,
  completed: <CheckCircle2Icon size={14} />,
  'tech-improvement': <WrenchIcon size={14} />,
};

export const CONTENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  'with-achievements': <TrophyIcon size={14} />,
  'with-voice': <Mic2Icon size={14} />,
  'from-workshop': <PackageIcon size={14} />,
};

export const TRANSLATION_TYPE_ICONS: Record<string, React.ReactNode> = {
  manual: <UserIcon size={14} />,
  ai: <AiIcon size={14} />,
  'ai-edited': <PencilIcon size={14} />,
};

export const LIBRARY_ICONS: Record<string, React.ReactNode> = {
  'installed-games': <MonitorIcon size={14} />,
  'available-in-steam': <SteamIcon size={14} />,
  'owned-gog-games': <GOGIcon size={14} />,
  'owned-epic-games': <EpicIcon size={14} />,
  'installed-xbox-games': <XboxIcon size={14} />,
};
