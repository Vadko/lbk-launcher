import { startAchievementPage } from './achievement-page';
import { takePageHint } from './achievement-page-hint';

// esbuild entry for the IIFE a host evaluates in Steam web pages; the host pushes strings through the Symbol.for global.
startAchievementPage({ hint: takePageHint() });
