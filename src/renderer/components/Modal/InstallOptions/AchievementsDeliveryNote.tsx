import { InfoIcon } from 'lucide-react';
import React from 'react';
import type { AchievementsBadge } from '@/shared/plugin-host-types';
import { openOfferTarget } from '../../../utils/openOfferTarget';
import { deliveryNote } from '../../../utils/pluginHostOffer';
import { OfferActionIcon } from '../../ui/OfferActionIcon';

const NOTE_ACTION_CLASS =
  'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90';
const NOTE_PRIMARY_CLASS = `${NOTE_ACTION_CLASS} bg-linear-to-r/srgb from-color-accent to-color-main text-text-dark`;
const NOTE_LINK_CLASS = 'inline-flex items-center gap-1 text-color-main hover:underline';

interface AchievementsDeliveryNoteProps {
  badge: AchievementsBadge;
}

export const AchievementsDeliveryNote: React.FC<AchievementsDeliveryNoteProps> = ({
  badge,
}) => {
  const note = deliveryNote(badge);
  if (!note) {
    return null;
  }
  return (
    <div className="bg-glass rounded-xl p-3 border border-border flex items-start gap-2 text-sm">
      <InfoIcon size={16} className="text-color-main shrink-0 mt-0.5" />
      <div className="text-text-muted min-w-0">
        <p>{note.text}</p>
        {note.actions.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {note.actions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => openOfferTarget(action.target, 'offer')}
                data-gamepad-modal-item
                className={
                  action.external || action.target === 'settings'
                    ? NOTE_LINK_CLASS
                    : NOTE_PRIMARY_CLASS
                }
              >
                <OfferActionIcon icon={action.icon} size={14} />
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
