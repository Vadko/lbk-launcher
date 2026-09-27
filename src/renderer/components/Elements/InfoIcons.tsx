import { Download, ThumbsUp } from 'lucide-react';
import React from 'react';

interface InfoIconsProps {
  likesCount?: number;
  downloadsCount?: number | null;
  floatPosition?: 'default' | 'compact' | null;
}

export const InfoIcons: React.FC<InfoIconsProps> = ({
  likesCount = 0,
  downloadsCount = 0,
  floatPosition = null,
}) => {
  const icons = [];

  if (likesCount > 0) {
    icons.push(
      <div className="flex items-center gap-1">
        <ThumbsUp size={16} />
        <span className="text-sm">{likesCount}</span>
      </div>
    );
  }

  icons.push(
    <div className="flex items-center gap-1">
      <Download size={16} />
      <span className="text-sm">
        {downloadsCount && downloadsCount > 20 ? downloadsCount : 'до 20'}
      </span>
    </div>
  );

  if (icons.length === 0) {
    return null;
  }

  return (
    <div
      className={`flex gap-2 ${floatPosition ? 'absolute rounded-ss-lg bg-glass p-2 pr-4 -bottom-px -right-px backdrop-blur-md backdrop-brightness-50' : ''}`}
    >
      {icons}
    </div>
  );
};
