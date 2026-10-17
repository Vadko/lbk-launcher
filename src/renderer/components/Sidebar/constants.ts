import { BookOpenText, Home, Medal, Newspaper, Trophy } from 'lucide-react';

/**
 * Крок картки в геймпад-стрічці: w-36 (144px) + відступ 12px.
 * Використовується і віртуалізатором (estimateSize), і геймпад-навігацією
 * (оцінка позиції скролу до ще не змонтованої картки) — має бути єдиним.
 */
export const GAMEPAD_CARD_STRIDE = 156;

/**
 * Оцінка висоти рядка вертикального списку: елемент ~76px + відступ 8px (pb-2).
 * Реальні висоти уточнює measureElement (розгорнуті групи вищі).
 */
export const GAME_LIST_ROW_ESTIMATE = 84;

export const MENU_BUTTONS = [
  {
    id: 'guides',
    icon: BookOpenText,
    path: '/site/guides&tools',
    title: 'Відкрити посібники та інструменти',
  },
  {
    id: 'donaters',
    icon: Medal,
    path: '/site/donaters',
    title: 'Відкрити сторінку донаторів',
  },
  {
    id: 'ratings',
    icon: Trophy,
    path: '/ratings',
    title: 'Відкрити рейтинги',
  },
  {
    id: 'news',
    icon: Newspaper,
    path: '/news',
    title: 'Відкрити новини',
  },
  {
    id: 'home',
    icon: Home,
    path: '/',
    title: 'Відкрити головну сторінку',
  },
];
