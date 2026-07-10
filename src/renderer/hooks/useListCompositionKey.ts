import { useEffect, useMemo } from 'react';

/**
 * Ключ складу списку: змінюється, коли міняється видача (пошук/фільтри/сортування).
 * Використовується як префікс key для перезапуску entrance-анімацій framer-motion
 * і скидає скрол контейнера на початок при новій видачі.
 */
export function useListCompositionKey(
  items: ReadonlyArray<{ key: string }>,
  scrollRef: React.RefObject<HTMLElement | null>,
  axis: 'vertical' | 'horizontal'
): string {
  const compositionKey = useMemo(() => {
    const first = items[0]?.key ?? '';
    const last = items[items.length - 1]?.key ?? '';
    return `${items.length}_${first}_${last}`;
  }, [items]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: скидаємо скрол саме на зміну складу списку
  useEffect(() => {
    scrollRef.current?.scrollTo(axis === 'vertical' ? { top: 0 } : { left: 0 });
  }, [compositionKey, scrollRef, axis]);

  return compositionKey;
}
