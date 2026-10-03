/**
 * Card stride in the gamepad strip: w-36 (144px) plus a 12px gap.
 * Used by both the virtualizer (estimateSize) and gamepad navigation
 * (estimating the scroll position of a card that is not mounted yet) — must stay single.
 */
export const GAMEPAD_CARD_STRIDE = 156;

/**
 * Row height estimate for the vertical list: item ~76px plus an 8px gap (pb-2).
 * measureElement refines the real heights (expanded groups are taller).
 */
export const GAME_LIST_ROW_ESTIMATE = 84;
