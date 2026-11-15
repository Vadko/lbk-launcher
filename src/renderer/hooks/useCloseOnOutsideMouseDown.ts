import { useEffect } from 'react';

// The gamepad closes an open list by dispatching a mousedown on the body
export function useCloseOnOutsideMouseDown(
  ref: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  close: () => void
) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const closeOutside = (e: MouseEvent) => {
      if (!(e.target instanceof Node) || !ref.current?.contains(e.target)) {
        close();
      }
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [ref, isOpen, close]);
}
