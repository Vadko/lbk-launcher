import React, { useCallback, useRef } from 'react';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const Input: React.FC<InputProps> = ({
  value,
  onChange,
  placeholder,
  icon,
  className = '',
}) => {
  // Track IME composition state to prevent double input on Steam Deck
  const isComposingRef = useRef(false);
  const justEndedCompositionRef = useRef(false);
  // Deduplication for Gamescope virtual keyboard: it fires two separate
  // input events per keypress (e.g. 'a' → onChange("a") then onChange("aa")).
  // We track the last InputEvent to detect and skip the duplicate.
  const lastInputEventTimeRef = useRef(0);
  const lastInputDataRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle native beforeinput to track what character is being inserted
  const handleBeforeInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const inputEvent = e.nativeEvent as InputEvent;
    if (inputEvent.inputType === 'insertText' && inputEvent.data) {
      const now = Date.now();
      // If the same character is being inserted within 50ms — it's a Gamescope duplicate
      if (
        inputEvent.data === lastInputDataRef.current &&
        now - lastInputEventTimeRef.current < 50
      ) {
        e.preventDefault();
        return;
      }
      lastInputDataRef.current = inputEvent.data;
      lastInputEventTimeRef.current = now;
    }
  }, []);

  return (
    <div className={`relative ${className}`}>
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
          {icon}
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onBeforeInput={handleBeforeInput}
        onChange={(e) => {
          // Skip onChange during IME composition to prevent double input
          if (isComposingRef.current) {
            return;
          }
          // Skip the onChange that fires right after onCompositionEnd
          if (justEndedCompositionRef.current) {
            justEndedCompositionRef.current = false;
            return;
          }
          onChange(e.target.value);
        }}
        onCompositionStart={() => {
          isComposingRef.current = true;
          justEndedCompositionRef.current = false;
        }}
        onCompositionEnd={(e) => {
          isComposingRef.current = false;
          justEndedCompositionRef.current = true;
          onChange(e.currentTarget.value);
        }}
        placeholder={placeholder}
        className={`w-full px-4 py-3 ${
          icon ? 'pl-12' : ''
        } bg-glass border border-border rounded-xl text-text-main placeholder:text-text-muted outline-none transition-all duration-300 backdrop-blur-lg relative z-0 glass-input`}
      />
    </div>
  );
};
