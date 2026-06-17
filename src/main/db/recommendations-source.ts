import recommendationsMap from './recommendations.json';

interface RecommendationsSource {
  getRecommendedIds(gameId: string): Promise<string[]>;
}

class JsonRecommendationsSource implements RecommendationsSource {
  async getRecommendedIds(gameId: string): Promise<string[]> {
    const rawIds = recommendationsMap[gameId as keyof typeof recommendationsMap] ?? [];

    if (!Array.isArray(rawIds)) {
      return [];
    }

    return rawIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
  }
}

let source: RecommendationsSource = new JsonRecommendationsSource();

export function setRecommendationsSource(nextSource: RecommendationsSource): void {
  source = nextSource;
}

export async function getRecommendedGameIds(gameId: string): Promise<string[]> {
  if (!gameId) {
    return [];
  }

  return source.getRecommendedIds(gameId);
}
