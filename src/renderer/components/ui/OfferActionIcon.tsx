import {
  CircleArrowUpIcon,
  DownloadIcon,
  ExternalLinkIcon,
  type LucideIcon,
  RotateCwIcon,
  Settings2Icon,
  Trash2Icon,
  WrenchIcon,
} from 'lucide-react';
import { createElement } from 'react';
import type { OfferIcon } from '../../utils/pluginHostOffer';

const ICONS: Record<OfferIcon, LucideIcon> = {
  download: DownloadIcon,
  external: ExternalLinkIcon,
  update: CircleArrowUpIcon,
  repair: WrenchIcon,
  remove: Trash2Icon,
  settings: Settings2Icon,
  restart: RotateCwIcon,
};

interface OfferActionIconProps {
  icon: OfferIcon;
  size: number;
}

export function OfferActionIcon({ icon, size }: OfferActionIconProps) {
  return createElement(ICONS[icon], { size });
}
