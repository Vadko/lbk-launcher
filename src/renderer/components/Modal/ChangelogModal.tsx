import { ChevronDown, ExternalLink, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { REPO_RELEASES_URL } from '../../../shared/repo';
import type { ChangelogEntry } from '../../../shared/types';
import { APP_VERSION } from '../../constants/appVersion';
import { compareVersions, useChangelogStore } from '../../store/useChangelogStore';
import { Modal } from './Modal';

const Entry: React.FC<{ entry: ChangelogEntry }> = ({ entry }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-baseline gap-2">
      <h4 className="text-base font-semibold text-text-main">{entry.title}</h4>
      <span className="text-xs text-text-muted">
        {entry.version} • {entry.date}
      </span>
    </div>
    <ul className="list-disc list-inside space-y-1">
      {entry.highlights.map((item, index) => (
        <li key={`${entry.version}-${index}`} className="text-sm text-text-muted">
          {item}
        </li>
      ))}
    </ul>
  </div>
);

export const ChangelogModal: React.FC = () => {
  const isOpen = useChangelogStore((state) => state.isOpen);
  const closeModal = useChangelogStore((state) => state.closeModal);
  const entries = useChangelogStore((state) => state.entries);
  const [showOlder, setShowOlder] = useState(false);

  // Список відсортований новішим догори, тож ріжемо по межі встановленої версії
  const upcomingCount = entries.filter(
    (entry) => compareVersions(entry.version, APP_VERSION) > 0
  ).length;
  const upcoming = entries.slice(0, upcomingCount);
  const [current, ...older] = entries.slice(upcomingCount);

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title="Що нового" usePortal>
      <div className="flex flex-col gap-6">
        {upcoming.length > 0 && (
          <div className="flex flex-col gap-4 p-4 rounded-xl border border-color-accent bg-color-accent/10">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-color-main" />
              <h3 className="text-sm font-semibold text-color-main">Буде в оновленні</h3>
            </div>
            {upcoming.map((entry) => (
              <Entry key={entry.version} entry={entry} />
            ))}
          </div>
        )}

        {current && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Ваша версія — v{APP_VERSION}
            </h3>
            <Entry entry={current} />
          </div>
        )}

        {older.length > 0 && (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setShowOlder((open) => !open)}
              className="flex items-center gap-2 text-sm text-text-muted hover:text-text-main transition-colors"
            >
              <ChevronDown
                size={16}
                className={`transition-transform duration-200 ${showOlder ? 'rotate-180' : ''}`}
              />
              Попередні версії ({older.length})
            </button>
            {showOlder &&
              older.map((entry) => (
                <div key={entry.version} className="pt-4 border-t border-white/10">
                  <Entry entry={entry} />
                </div>
              ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => window.electronAPI?.openExternal?.(REPO_RELEASES_URL)}
          className="flex items-center gap-2 text-xs text-text-muted hover:text-text-main transition-colors"
        >
          <ExternalLink size={14} />
          Повний список змін на GitHub
        </button>
      </div>
    </Modal>
  );
};
