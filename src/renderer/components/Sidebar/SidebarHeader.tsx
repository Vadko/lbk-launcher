import logo from '@resources/logo.svg';
import {
  BookOpenTextIcon,
  HomeIcon,
  MedalIcon,
  NewspaperIcon,
  TrophyIcon,
} from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@/shared/i18n/i18n';

interface SidebarHeaderProps {
  isCompact?: boolean;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = React.memo(
  ({ isCompact = false }) => {
    const navigate = useNavigate();
    return (
      <div
        className={`relative flex items-center justify-between gap-3 select-none overflow-visible ${
          isCompact ? '' : 'border-b p-3 pl-4 border-border'
        }`}
      >
        <img
          src={logo}
          alt="LBK logo"
          className={isCompact ? 'w-16 h-8 object-cover' : 'w-20 h-14  object-cover'}
          draggable={false}
        />
        {!isCompact && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('/site/guides&tools')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-main hover:bg-white/10 active:scale-95 transition-all"
              title={t('sidebarNav.guides')}
            >
              <BookOpenTextIcon size={20} />
            </button>
            <button
              onClick={() => navigate('/site/donaters')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-main hover:bg-white/10 active:scale-95 transition-all"
              title={t('sidebarNav.donators')}
            >
              <MedalIcon size={20} />
            </button>
            <button
              onClick={() => navigate('/ratings')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-main hover:bg-white/10 active:scale-95 transition-all"
              title={t('sidebarNav.ratings')}
            >
              <TrophyIcon size={20} />
            </button>
            <button
              onClick={() => navigate('/news')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-main hover:bg-white/10 active:scale-95 transition-all"
              title={t('sidebarNav.news')}
            >
              <NewspaperIcon size={20} />
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-main hover:bg-white/10 active:scale-95 transition-all"
              title={t('sidebarNav.home')}
            >
              <HomeIcon size={20} />
            </button>
          </div>
        )}
      </div>
    );
  }
);
