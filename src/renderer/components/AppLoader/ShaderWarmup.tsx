import logo from '../../../../resources/logo.svg';
import mainBg from '../../../../resources/main-bg.webp';

/**
 * Прогрів GPU-пайплайнів за лоадером.
 *
 * На холодному кеші шейдерів (перший запуск після оновлення Electron або
 * очистки кешу) GPU-процес компілює Metal-пайплайн для кожної нової комбінації
 * ефектів по 100–250мс за штуку — і перші секунди анімації дропають кадри.
 * Цей блок рендерить (майже невидимо, opacity 1.5%) ті самі комбінації, що
 * зустрічаються на HomePage/GamePage, поки їх прикриває AppLoader: компіляція
 * відбувається за лоадером, а не під час перших кліків користувача.
 */
export const ShaderWarmup = () => (
  <div
    aria-hidden="true"
    className="absolute bottom-0 left-0 w-24 h-24 opacity-[0.015] pointer-events-none overflow-hidden"
  >
    {/* Растрове зображення із заокругленням і scale (картки ігор) */}
    <img
      src={mainBg}
      alt=""
      className="absolute inset-0 w-full h-full object-cover rounded-xl scale-105"
    />
    {/* Розмите растрове зображення (adult-blur на обкладинках) */}
    <img
      src={logo}
      alt=""
      className="absolute top-0 right-0 w-8 h-8 blur-lg drop-shadow-2xl"
    />
    {/* Glass-панель: backdrop-blur над растром + бордер + тіні (glass-card/panel) */}
    <div className="absolute inset-0 backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.3),0_0_20px_rgba(255,255,255,0.2)]" />
    {/* Дво-стопний градієнт + blur-glow (лоадер, кнопки, ховери) */}
    <div className="absolute inset-2 rounded-full bg-gradient-to-r from-color-accent/20 to-color-main/20 blur-md" />
    {/* Багато-стопний градієнт (інша спеціалізація шейдера, ніж 2-стопний) */}
    <div className="absolute inset-6 rounded bg-[linear-gradient(90deg,#511_0%,#151_25%,#115_50%,#551_75%,#155_100%)]" />
    {/* Градієнтний текст через bg-clip-text (заголовки) */}
    <span className="absolute bottom-0 left-0 text-[8px] font-bold bg-gradient-to-r from-color-accent to-color-main bg-clip-text text-transparent">
      warmup
    </span>
    {/* Ланцюжок фільтрів blur+drop-shadow на растрі (GameHero, Gallery) */}
    <img
      src={logo}
      alt=""
      className="absolute bottom-0 right-0 w-6 h-6 blur-[2px] drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]"
    />
    {/* Напівпрозора група з блюр-дитиною: offscreen-layer пайплайн (модалки) */}
    <div className="absolute top-8 left-8 opacity-50">
      <div className="w-4 h-4 rounded-full blur-sm bg-white/20" />
    </div>
    {/* Текст із тінню (заголовки поверх банерів) */}
    <span
      className="absolute top-0 left-0 text-[8px] text-white"
      style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
    >
      w
    </span>
  </div>
);
