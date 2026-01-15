import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // За замовчуванням кешуємо на 5 хвилин
      staleTime: 5 * 60 * 1000,
      // Зберігаємо в кеші 30 хвилин
      gcTime: 30 * 60 * 1000,
      // Не рефетчити при фокусі вікна (Electron)
      refetchOnWindowFocus: false,
      // Повторювати 1 раз при помилці
      retry: 1,
    },
  },
});
