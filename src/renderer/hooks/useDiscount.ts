// Stub: set to a number to preview the badge until a real data source is wired up
const MOCK_STEAM_PERCENT: number | null = import.meta.env.VITE_MOCK_STEAM_PERCENT;

export const useSteamDiscount = (): number => MOCK_STEAM_PERCENT || 0;
