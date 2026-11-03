import { useSteamDiscountsStore } from '../store/useSteamDiscountsStore';

export function useSteamDiscount(steamAppId: number | null): number {
  return useSteamDiscountsStore((state) =>
    steamAppId === null ? 0 : (state.percents.get(steamAppId) ?? 0)
  );
}
