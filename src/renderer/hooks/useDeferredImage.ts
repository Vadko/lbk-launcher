import { useState } from 'react';

export function useDeferredImage(imageDeferred: boolean, resetKey: string): boolean {
  const [settled, setSettled] = useState(!imageDeferred);

  const [prevKey, setPrevKey] = useState(resetKey);

  if (prevKey !== resetKey) {
    setPrevKey(resetKey);
    setSettled(!imageDeferred);
  } else if (!imageDeferred && !settled) {
    setSettled(true);
  }

  return settled;
}
