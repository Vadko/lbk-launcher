import logo from '../../../../resources/logo.svg';
import mainBg from '../../../../resources/main-bg.webp';

/**
 * Warm up GPU pipelines behind the loader.
 *
 * On a cold shader cache (first launch after an Electron update or a
 * cache clear) the GPU process compiles a Metal pipeline for each new
 * effect combination at 100-250ms apiece — and the first seconds of
 * animation drop frames. This block renders (almost invisibly, opacity
 * 1.5%) the same combinations that occur on HomePage/GamePage while
 * AppLoader covers them: compilation happens behind the loader, not
 * during the user's first clicks.
 */
export const ShaderWarmup = () => (
  <div
    aria-hidden="true"
    className="absolute bottom-0 left-0 w-24 h-24 opacity-[0.015] pointer-events-none overflow-hidden"
  >
    {/* Raster image with rounding and scale (game cards) */}
    <img
      src={mainBg}
      alt=""
      className="absolute inset-0 w-full h-full object-cover rounded-xl scale-105"
    />
    {/* Blurred raster image (adult-blur on covers) */}
    <img
      src={logo}
      alt=""
      className="absolute top-0 right-0 w-8 h-8 blur-lg drop-shadow-2xl"
    />
    {/* Glass panel: backdrop-blur over raster + border + shadows (glass-card/panel) */}
    <div className="absolute inset-0 backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.3),0_0_20px_rgba(255,255,255,0.2)]" />
    {/* Two-stop gradient + blur-glow (loader, buttons, hovers) */}
    <div className="absolute inset-2 rounded-full bg-linear-to-r/srgb from-color-accent/20 to-color-main/20 blur-md" />
    {/* Multi-stop gradient (a different shader specialization than the 2-stop one) */}
    <div className="absolute inset-6 rounded-sm bg-[linear-gradient(90deg,#511_0%,#151_25%,#115_50%,#551_75%,#155_100%)]" />
    {/* Gradient text via bg-clip-text (headings) */}
    <span className="absolute bottom-0 left-0 text-[8px] font-bold bg-linear-to-r/srgb from-color-accent to-color-main bg-clip-text text-transparent">
      warmup
    </span>
    {/* Chained blur+drop-shadow filters on a raster (GameHero, Gallery) */}
    <img
      src={logo}
      alt=""
      className="absolute bottom-0 right-0 w-6 h-6 blur-[2px] drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]"
    />
    {/* Semi-transparent group with a blurred child: offscreen-layer pipeline (modals) */}
    <div className="absolute top-8 left-8 opacity-50">
      <div className="w-4 h-4 rounded-full blur-xs bg-white/20" />
    </div>
    {/* Text with a shadow (headings over banners) */}
    <span
      className="absolute top-0 left-0 text-[8px] text-white"
      style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
    >
      w
    </span>
  </div>
);
