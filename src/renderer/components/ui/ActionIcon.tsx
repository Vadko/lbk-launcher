import { Check, LoaderCircle, X } from 'lucide';
import { type IconInput, MorphIcon, type ReducedMotionMode } from 'morphicons/react';
import React, { useEffect, useState } from 'react';
import type { ActionPhase } from '../../hooks/useActionPhase';

export interface ActionIconProps {
  phase: ActionPhase;
  icon?: IconInput;
  size?: number;
  className?: string;
  doneClassName?: string;
  errorClassName?: string;
  pendingClassName?: string;
  label?: string;
  reducedMotion?: ReducedMotionMode;
}

const MORPH_SPRING = { stiffness: 800, damping: 42 };
const PENDING_DELAY_MS = 100;
const SPIN_DELAY_MS = 180;

const PHASE_ICONS: Partial<Record<ActionPhase, IconInput>> = {
  done: Check,
  error: X,
};

export const ActionIcon: React.FC<ActionIconProps> = ({
  phase,
  icon,
  size = 16,
  className = '',
  doneClassName = 'text-color-main',
  errorClassName = 'text-red-400',
  pendingClassName = 'text-color-main',
  label,
  reducedMotion = 'user',
}) => {
  const [pendingVisible, setPendingVisible] = useState(false);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (phase !== 'pending') {
      return;
    }
    const pendingTimer = setTimeout(() => setPendingVisible(true), PENDING_DELAY_MS);
    const spinTimer =
      reducedMotion === 'always'
        ? null
        : setTimeout(() => setSpinning(true), PENDING_DELAY_MS + SPIN_DELAY_MS);
    return () => {
      clearTimeout(pendingTimer);
      if (spinTimer !== null) {
        clearTimeout(spinTimer);
      }
      setPendingVisible(false);
      setSpinning(false);
    };
  }, [phase, reducedMotion]);

  const showPending = phase === 'pending' && pendingVisible;
  const glyph = showPending ? LoaderCircle : (PHASE_ICONS[phase] ?? icon);
  const phaseColor = showPending
    ? pendingClassName
    : phase === 'done'
      ? doneClassName
      : phase === 'error'
        ? errorClassName
        : '';

  return (
    <span
      className={`inline-grid shrink-0 place-items-center align-middle ${showPending && spinning ? 'animate-spin motion-reduce:animate-none' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      {glyph === undefined ? null : (
        <MorphIcon
          icon={glyph}
          size={size}
          spring={MORPH_SPRING}
          reducedMotion={reducedMotion}
          className={phaseColor}
          label={label}
        />
      )}
    </span>
  );
};
