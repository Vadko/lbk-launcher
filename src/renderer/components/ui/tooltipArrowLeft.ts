export type TooltipAlign = 'center' | 'left' | 'right';

// Keeps the arrow off the rounded corners
const ARROW_INSET = 8;

// Where the arrow sits from the tooltip's left edge so it points at the trigger's centre
export function tooltipArrowLeft(
  align: TooltipAlign,
  triggerWidth: number,
  tooltipWidth: number
): number {
  const tooltipLeft =
    align === 'left'
      ? triggerWidth - tooltipWidth
      : align === 'right'
        ? 0
        : (triggerWidth - tooltipWidth) / 2;
  const triggerCenter = triggerWidth / 2 - tooltipLeft;
  return Math.max(ARROW_INSET, Math.min(tooltipWidth - ARROW_INSET, triggerCenter));
}
