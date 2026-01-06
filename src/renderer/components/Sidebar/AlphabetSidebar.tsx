import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface AlphabetSidebarProps {
  alphabet: string[];
  onLetterClick: (letter: string) => void;
  activeHighlight?: string;
}

export const AlphabetSidebar: React.FC<AlphabetSidebarProps> = React.memo(
  ({ alphabet, onLetterClick, activeHighlight }) => {
    const [activeLetter, setActiveLetter] = useState<string | null>(null);
    const [isInteracting, setIsInteracting] = useState(false);
    const [bubblePos, setBubblePos] = useState({ top: 0, right: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const letterRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    const displayLetter = isInteracting ? activeLetter : activeHighlight;

    const findClosestLetter = useCallback((clientY: number) => {
      let closest: { letter: string; rect: DOMRect } | null = null;
      let closestDist = Infinity;

      for (const [letter, el] of letterRefs.current) {
        const rect = el.getBoundingClientRect();
        const dist = Math.abs(clientY - (rect.top + rect.height / 2));

        if (dist < closestDist) {
          closestDist = dist;
          closest = { letter, rect };
        }
      }

      return closest;
    }, []);

    const handleInteraction = useCallback(
      (clientY: number, shouldTriggerClick = false) => {
        if (!containerRef.current) return;

        const closest = findClosestLetter(clientY);
        if (!closest) return;

        const { letter, rect } = closest;

        if (letter !== activeLetter) {
          setActiveLetter(letter);
        }

        if (shouldTriggerClick || (isInteracting && letter !== activeLetter)) {
          onLetterClick(letter);
        }

        setBubblePos({
          top: rect.top + rect.height / 2,
          right: document.documentElement.clientWidth - rect.left + 12,
        });
      },
      [findClosestLetter, onLetterClick, activeLetter, isInteracting]
    );

    const onPointerDown = (e: React.PointerEvent) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsInteracting(true);
      handleInteraction(e.clientY, true);
    };

    const onPointerMove = (e: React.PointerEvent) => {
      e.preventDefault();
      // Allow hover to trigger interaction update (show bubble) but not scroll
      handleInteraction(e.clientY, isInteracting);
    };

    const onPointerUp = (e: React.PointerEvent) => {
      e.preventDefault();
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsInteracting(false);
      setActiveLetter(null);
    };

    const onPointerLeave = () => {
      if (!isInteracting) {
        setActiveLetter(null);
      }
    };

    return (
      <>
        <div
          className="flex flex-col py-2 w-7 h-[calc(100%-16px)] my-2 mr-2 ml-1 bg-[var(--glass)] backdrop-blur-md rounded-full border border-[var(--border)] select-none touch-none z-10 cursor-pointer shadow-lg"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
        >
          <div
            ref={containerRef}
            className="flex flex-col justify-between items-center h-full w-full px-1"
          >
            {alphabet.map((letter) => (
              <div
                key={letter}
                ref={(el) => {
                  if (el) letterRefs.current.set(letter, el);
                  else letterRefs.current.delete(letter);
                }}
                className={`text-[10px] font-medium leading-none flex items-center justify-center w-5 h-5 rounded-full transition-all duration-200 pointer-events-none ${
                  displayLetter === letter
                    ? 'bg-[var(--text-main)] text-[var(--bg-dark)] font-bold shadow-sm scale-110'
                    : 'text-text-muted hover:text-[var(--text-main)]'
                }`}
              >
                {letter}
              </div>
            ))}
          </div>
        </div>

        {activeLetter &&
          createPortal(
            <div
              className="fixed z-50 flex items-center justify-center pointer-events-none"
              style={{
                top: bubblePos.top,
                right: bubblePos.right,
                transform: 'translateY(-50%)',
              }}
            >
              <div className="relative flex items-center justify-center w-14 h-14 rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.4)] bg-glass backdrop-blur-md border border-neon-blue/40">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent" />
                <span className="text-2xl font-bold font-head text-neon-blue drop-shadow-[0_0_10px_rgba(0,242,255,0.6)]">
                  {activeLetter}
                </span>
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-l-[10px] border-l-neon-blue/40 border-b-[8px] border-b-transparent" />
              </div>
            </div>,
            document.body
          )}
      </>
    );
  }
);
