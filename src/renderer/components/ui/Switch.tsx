import * as React from 'react';
import { motion } from 'framer-motion';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  id?: string;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, className, id }, ref) => {
    const [isPressed, setIsPressed] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);

    return (
      <button
        ref={ref}
        role="switch"
        aria-checked={checked}
        type="button"
        onClick={() => onCheckedChange(!checked)}
        onPointerDown={() => setIsPressed(true)}
        onPointerUp={() => setIsPressed(false)}
        onPointerLeave={() => {
          setIsPressed(false);
          setIsHovered(false);
        }}
        onPointerEnter={() => setIsHovered(true)}
        className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full overflow-hidden ${className || ''}`}
      >
        {/* Gradient background (checked state) */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-neon-blue to-neon-purple"
          initial={false}
          animate={{
            opacity: checked ? 1 : 0,
          }}
          transition={{
            duration: 0.3,
            ease: 'easeInOut',
          }}
          style={{
            filter: checked ? 'drop-shadow(0 0 12px rgba(0, 242, 255, 0.4))' : 'none',
          }}
        />

        {/* Gray background (unchecked state) */}
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={{
            opacity: checked ? 0 : 1,
            backgroundColor: isHovered ? '#9ca3af' : '#d1d5db',
          }}
          transition={{
            duration: 0.3,
            ease: 'easeInOut',
          }}
        />

        <motion.div
          layoutId={id}
          className="relative block h-6 w-6 rounded-full bg-white shadow-md pointer-events-none m-1 z-10"
          initial={false}
          animate={{
            x: checked ? 24 : 0,
            scale: isPressed ? 0.9 : 1,
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
        />
      </button>
    );
  }
);

Switch.displayName = 'Switch';
