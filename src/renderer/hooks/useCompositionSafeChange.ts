import { type ChangeEvent, type CompositionEvent, useRef } from 'react';

// Safety net for non-Gamescope Linux, where GTK_IM_MODULE is still set: an IME composition would otherwise input twice
export function useCompositionSafeChange(onChange: (value: string) => void) {
  const isComposingRef = useRef(false);
  const justEndedCompositionRef = useRef(false);

  return {
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      if (isComposingRef.current) {
        return;
      }
      if (justEndedCompositionRef.current) {
        justEndedCompositionRef.current = false;
        return;
      }
      onChange(e.target.value);
    },
    onCompositionStart: () => {
      isComposingRef.current = true;
      justEndedCompositionRef.current = false;
    },
    onCompositionEnd: (e: CompositionEvent<HTMLInputElement>) => {
      isComposingRef.current = false;
      justEndedCompositionRef.current = true;
      onChange(e.currentTarget.value);
    },
  };
}
