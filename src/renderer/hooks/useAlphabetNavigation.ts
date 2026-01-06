import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

interface GameGroup {
  slug: string;
  name: string;
}

const LETTER_REGEX = /[A-ZА-ЯҐЄІЇ]/;
const SCROLL_HIGHLIGHT_TIMEOUT = 1000;
const SCROLL_ANIMATION_DURATION = 200;
const SCROLL_TRIGGER_OFFSET = 50;

function getFirstLetter(name: string): string {
  const firstChar = name.charAt(0).toUpperCase();
  return LETTER_REGEX.test(firstChar) ? firstChar : '#';
}

function smoothScrollTo(container: HTMLElement, target: number, duration: number) {
  const start = container.scrollTop;
  const distance = target - start;
  const startTime = performance.now();

  const animate = (currentTime: number) => {
    const timeElapsed = currentTime - startTime;
    const progress = Math.min(timeElapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);

    container.scrollTop = start + distance * ease;

    if (timeElapsed < duration) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
}

export function useAlphabetNavigation(gameGroups: GameGroup[]) {
  const listRef = useRef<HTMLDivElement>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const activeLetterTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sortedAlphabet = useMemo(() => {
    const letters = new Set<string>();

    gameGroups.forEach((group) => {
      letters.add(getFirstLetter(group.name));
    });

    return Array.from(letters).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;

      const isALatin = /[A-Z]/.test(a);
      const isBLatin = /[A-Z]/.test(b);

      if (isALatin && !isBLatin) return -1;
      if (!isALatin && isBLatin) return 1;

      return a.localeCompare(b);
    });
  }, [gameGroups]);

  useEffect(
    () => () => {
      if (activeLetterTimeoutRef.current) {
        clearTimeout(activeLetterTimeoutRef.current);
      }
    },
    []
  );

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      const { scrollTop, clientHeight, scrollHeight } = container;

      if (activeLetterTimeoutRef.current) {
        clearTimeout(activeLetterTimeoutRef.current);
      }

      let foundLetter: string | null = null;

      const isAtBottom =
        Math.abs(scrollHeight - clientHeight - scrollTop) < SCROLL_TRIGGER_OFFSET;

      if (isAtBottom) {
        const lastGroup = gameGroups[gameGroups.length - 1];
        if (lastGroup) {
          foundLetter = getFirstLetter(lastGroup.name);
        }
      } else {
        const triggerLine = scrollTop + SCROLL_TRIGGER_OFFSET;
        let activeGroup = null;

        for (const group of gameGroups) {
          const element = document.getElementById(`group-${group.slug}`);
          if (!element) continue;

          if (element.offsetTop <= triggerLine) {
            activeGroup = group;
          } else {
            break;
          }
        }

        if (activeGroup) {
          foundLetter = getFirstLetter(activeGroup.name);
        }
      }

      if (foundLetter) {
        setActiveLetter(foundLetter);

        activeLetterTimeoutRef.current = setTimeout(() => {
          setActiveLetter(null);
        }, SCROLL_HIGHLIGHT_TIMEOUT);
      }
    },
    [gameGroups]
  );

  const handleLetterClick = useCallback(
    (letter: string) => {
      const targetGroup = gameGroups.find((g) => getFirstLetter(g.name) === letter);

      if (targetGroup && listRef.current) {
        const element = document.getElementById(`group-${targetGroup.slug}`);
        if (element) {
          smoothScrollTo(listRef.current, element.offsetTop, SCROLL_ANIMATION_DURATION);
        }
      }
    },
    [gameGroups]
  );

  return {
    listRef,
    sortedAlphabet,
    activeLetter,
    handleScroll,
    handleLetterClick,
  };
}
