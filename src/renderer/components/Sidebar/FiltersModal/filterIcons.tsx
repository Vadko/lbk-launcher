import {
  CalendarClock,
  CheckCircle2,
  Hammer,
  Mic2,
  Monitor,
  Package,
  Trophy,
  User,
  Wrench,
} from 'lucide-react';
import React from 'react';
import { AiIcon } from '../../Icons/AiIcon';
import { EpicIcon, GOGIcon, SteamIcon, XboxIcon } from '../../Icons/BrandIcons';
import { PencilIcon } from '../../Icons/PencilIcon';

export const STATUS_ICONS: Record<string, React.ReactNode> = {
  planned: <CalendarClock size={14} />,
  'in-progress': <Hammer size={14} />,
  completed: <CheckCircle2 size={14} />,
  'tech-improvement': <Wrench size={14} />,
};

export const CONTENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  'with-achievements': <Trophy size={14} />,
  'with-voice': <Mic2 size={14} />,
  'from-workshop': <Package size={14} />,
};

export const TRANSLATION_TYPE_ICONS: Record<string, React.ReactNode> = {
  manual: <User size={14} />,
  ai: <AiIcon size={14} />,
  'ai-edited': <PencilIcon size={14} />,
};

export const LIBRARY_ICONS: Record<string, React.ReactNode> = {
  'installed-games': <Monitor size={14} />,
  'available-in-steam': <SteamIcon size={14} />,
  'owned-gog-games': <GOGIcon size={14} />,
  'owned-epic-games': <EpicIcon size={14} />,
  'installed-xbox-games': <XboxIcon size={14} />,
};
