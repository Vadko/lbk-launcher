import { Star } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { getSpecialTranslatorInfo } from '../../constants/specialTranslators';
import { Tooltip } from '../ui/Tooltip';

interface AuthorsListProps {
  team: string;
  maxVisible?: number;
}

export const AuthorsList: React.FC<AuthorsListProps> = ({ team, maxVisible = 3 }) => {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const authors = team.split(',').map((a) => a.trim());
  const visibleAuthors = authors.slice(0, maxVisible);
  const hiddenAuthors = authors.slice(maxVisible);
  const hasMore = hiddenAuthors.length > 0;

  const renderAuthor = (author: string, showComma: boolean) => {
    const specialInfo = getSpecialTranslatorInfo(author);
    const isSpecial = specialInfo !== null;

    return (
      <span key={author}>
        <span className={isSpecial ? 'text-yellow-400' : ''}>
          {author}
          {isSpecial && specialInfo && (
            <Tooltip content={specialInfo.description}>
              <Star
                size={12}
                className="ml-1 fill-yellow-400 text-yellow-400 cursor-help"
              />
            </Tooltip>
          )}
        </span>
        {showComma && <span className="text-text-main">, </span>}
      </span>
    );
  };

  return (
    <div className="font-medium text-text-main">
      {visibleAuthors.map((author, index) =>
        renderAuthor(author, index < visibleAuthors.length - 1 || hasMore)
      )}

      {hasMore && (
        <span className="relative inline-block">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setShowPopover(!showPopover)}
            onBlur={(e) => {
              // Close popover when clicking outside
              if (!popoverRef.current?.contains(e.relatedTarget as Node)) {
                setShowPopover(false);
              }
            }}
            className="text-text-muted hover:text-text-main transition-colors"
          >
            +{hiddenAuthors.length}
          </button>

          {showPopover && (
            <div
              ref={popoverRef}
              className="absolute left-0 bottom-full mb-2 z-[100] min-w-[200px] p-3 rounded-xl bg-bg-dark border border-border shadow-2xl"
            >
              <div className="text-xs text-text-muted mb-2">Інші автори:</div>
              <div className="space-y-1">
                {hiddenAuthors.map((author) => {
                  const specialInfo = getSpecialTranslatorInfo(author);
                  const isSpecial = specialInfo !== null;

                  return (
                    <div key={author} className="flex items-center gap-1">
                      <span className={isSpecial ? 'text-yellow-400' : 'text-text-main'}>
                        {author}
                      </span>
                      {isSpecial && specialInfo && (
                        <Tooltip content={specialInfo.description}>
                          <Star
                            size={12}
                            className="fill-yellow-400 text-yellow-400 cursor-help"
                          />
                        </Tooltip>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </span>
      )}
    </div>
  );
};
