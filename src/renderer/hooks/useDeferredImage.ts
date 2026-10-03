import { useEffect, useRef, useState } from 'react';

export function useDeferredImage(imageDeferred: boolean, resetKey: string): boolean {
  const [settled, setSettled] = useState(!imageDeferred);

  const prevKeyRef = useRef(resetKey);
  /* eslint-disable react-hooks/set-state-in-effect -- intentional reset on game change */
  useEffect(() => {
    // Key guard: the effect doesn't reset the latch on imageDeferred changes alone
    if (prevKeyRef.current !== resetKey) {
      prevKeyRef.current = resetKey;
      setSettled(!imageDeferred);
    }
  }, [resetKey, imageDeferred]);

  useEffect(() => {
    if (!imageDeferred) {
      setSettled(true);
    }
  }, [imageDeferred]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return settled;
}
