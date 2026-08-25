import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Button } from './Button';

interface WorkshopInstallButtonProps {
  gameId: string;
  workshopId: string;
  disabled?: boolean;
}

export function WorkshopInstallButton({
  gameId,
  workshopId,
  disabled,
}: WorkshopInstallButtonProps) {
  const [isOpening, setIsOpening] = useState(false);

  const handleClick = async () => {
    setIsOpening(true);
    try {
      void window.electronAPI
        .trackWorkshopOpen(gameId)
        .catch((error: unknown) => console.error('[Workshop] tracking failed', error));

      await window.electronAPI.openExternal(
        `steam://url/CommunityFilePage/${workshopId}`
      );
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <Button
      variant="primary"
      icon={<ExternalLink size={20} />}
      onClick={handleClick}
      disabled={disabled || isOpening}
      data-gamepad-primary-action
      data-gamepad-action
    >
      Встановити зі Steam
    </Button>
  );
}
