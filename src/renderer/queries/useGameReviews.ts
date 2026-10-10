import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { GameReviewsPage } from '@/shared/types';

const PAGE_SIZE = 10;
const THIRTY_MINUTES = 30 * 60 * 1000;
const USE_MOCK_REVIEWS = import.meta.env.VITE_USE_MOCK_REVIEWS === 'true';
const MOCK_TOTAL = 262;
const MOCK_TEXTS = [
  'Переклад дуже якісний. Діалоги читаються природно, а описи предметів зрозумілі. Рекомендую.',
  'Переклад чудовий. Шрифти гарні, інтерфейс читабельний. Рекомендую всім.',
  'Переклад майже ідеальний. Дрібних помилок не знайшла. Дякую перекладачам!',
  'Є кілька неточностей у квестових записах, але загалом грати дуже комфортно.',
  'Нарешті можна пройти гру рідною мовою. Дякую за роботу!',
];

const MOCK_REPLIES = [
  'Дякуємо за відгук! Раді, що переклад вам сподобався.',
  'Дякуємо, що вказали на неточності. Виправимо в наступному оновленні.',
];

function mockReplyCount(index: number): number {
  if (index % 7 === 0) {
    return 2;
  }
  return index % 3 === 0 ? 1 : 0;
}

async function fetchGameReviews(gameId: string, page: number): Promise<GameReviewsPage> {
  const result = await window.electronAPI.fetchGameReviews(gameId, page, PAGE_SIZE);
  if (!result) {
    throw new Error('Не вдалося завантажити відгуки');
  }
  return result;
}

async function fetchGameReviewsMock(
  gameId: string,
  page: number
): Promise<GameReviewsPage> {
  await new Promise((resolve) => setTimeout(resolve, 400));

  const offset = (page - 1) * PAGE_SIZE;
  const count = Math.max(0, Math.min(PAGE_SIZE, MOCK_TOTAL - offset));
  const items = Array.from({ length: count }, (_, i) => {
    const index = offset + i;
    return {
      id: `${gameId}-${index}`,
      text: MOCK_TEXTS[index % MOCK_TEXTS.length],
      createdAt: new Date(Date.now() - index * 7 * 60 * 60 * 1000).toISOString(),
      images: Array.from(
        { length: index % 4 },
        (_, n) => `https://picsum.photos/seed/${gameId}-${index}-${n}/1280/720`
      ),
      replies: Array.from({ length: mockReplyCount(index) }, (_, r) => ({
        id: `${gameId}-${index}-reply-${r}`,
        text: MOCK_REPLIES[(index + r) % MOCK_REPLIES.length],
        createdAt: new Date(
          Date.now() - index * 7 * 60 * 60 * 1000 + (r + 1) * 60 * 60 * 1000
        ).toISOString(),
      })),
    };
  });

  return { items, total: MOCK_TOTAL, pageSize: PAGE_SIZE };
}

export function useGameReviews(gameId: string, page: number) {
  return useQuery({
    queryKey: ['game-reviews', gameId, page],
    queryFn: () =>
      USE_MOCK_REVIEWS
        ? fetchGameReviewsMock(gameId, page)
        : fetchGameReviews(gameId, page),
    staleTime: THIRTY_MINUTES,
    gcTime: THIRTY_MINUTES,
    placeholderData: keepPreviousData,
  });
}
