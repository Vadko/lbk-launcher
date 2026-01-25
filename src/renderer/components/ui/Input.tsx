import React, { useRef } from 'react';

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
  // Track if we just ended composition to skip the duplicate onChange
  const justEndedCompositionRef = useRef(false);
  // Fallback deduplication for Gamescope keyboard (may not fire IME events)
  const lastValueRef = useRef(value);
  const lastChangeTimeRef = useRef(0);

  return (
    <div className={`relative ${className}`}>
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
          {icon}
        </div>
      )}
      <input
        type="text"
        value={value}
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
          const newValue = e.target.value;
          const now = Date.now();
          // Deduplicate rapid identical onChange events from Gamescope virtual keyboard
          // (fires both keyboard event and direct input event simultaneously)
          if (newValue === lastValueRef.current && now - lastChangeTimeRef.current < 100) {
            return;
          }
          lastValueRef.current = newValue;
          lastChangeTimeRef.current = now;
          onChange(newValue);
        }}
        onCompositionStart={() => {
          isComposingRef.current = true;
          justEndedCompositionRef.current = false;
        }}
        onCompositionEnd={(e) => {
          isComposingRef.current = false;
          justEndedCompositionRef.current = true;
          // Fire onChange after composition ends with final value
          const newValue = e.currentTarget.value;
          lastValueRef.current = newValue;
          lastChangeTimeRef.current = Date.now();
          onChange(newValue);
        }}
        placeholder={placeholder}
        className={`w-full px-4 py-3 ${
          icon ? 'pl-12' : ''
        } bg-glass border border-border rounded-xl text-text-main placeholder:text-text-muted outline-none transition-all duration-300 backdrop-blur-lg relative z-0 glass-input`}
      />
    </div>
  );
};
