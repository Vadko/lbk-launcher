import { startAchievementPage } from './achievement-page';

// esbuild entry for the IIFE a host evaluates in Steam web pages; the host pushes strings through the Symbol.for global.
startAchievementPage();
