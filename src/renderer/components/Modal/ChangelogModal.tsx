import React from 'react';
import { CHANGELOG, useChangelogStore } from '../../store/useChangelogStore';
import { Modal } from './Modal';

export const ChangelogModal: React.FC = () => {
  const isOpen = useChangelogStore((state) => state.isOpen);
  const closeModal = useChangelogStore((state) => state.closeModal);

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title="Що нового" usePortal>
      <div className="flex flex-col gap-6">
        {CHANGELOG.map((entry, index) => (
          <div key={entry.version} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <h4 className="text-base font-semibold text-text-main">{entry.title}</h4>
              <span className="text-xs text-text-muted">
                {entry.version} • {entry.date}
              </span>
            </div>
            <ul className="list-disc list-inside space-y-1">
              {entry.highlights.map((item) => (
                <li key={item} className="text-sm text-text-muted">
                  {item}
                </li>
              ))}
            </ul>
            {index < CHANGELOG.length - 1 && (
              <div className="border-t border-white/10 pt-4" />
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
};
