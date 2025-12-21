import type { BrowserWindow } from 'electron';
import { supportsMacOSLiquidGlass, shouldEnableLiquidGlass } from './utils/platform';

// Conditionally import based on platform
const liquidGlass =
  process.platform === 'darwin' ? require('electron-liquid-glass') : null;

/**
 * Initialize liquid glass for a window
 * @param window The BrowserWindow to apply liquid glass to
 * @param userPreference Whether the user has enabled liquid glass in settings
 * @returns The glass ID if successful, null otherwise
 */
export async function applyLiquidGlass(
  window: BrowserWindow,
  userPreference = true
): Promise<number | null> {
  try {
    // Check if we should enable liquid glass
    if (!shouldEnableLiquidGlass(userPreference)) {
      console.log(
        '[LiquidGlass] Not applying - either not supported or disabled by user'
      );
      return null;
    }

    // Check if module is available
    if (!liquidGlass) {
      console.log('[LiquidGlass] Module not available on this platform');
      return null;
    }

    // Get the native window handle
    const handle = window.getNativeWindowHandle();
    if (!handle) {
      console.warn('[LiquidGlass] Could not get native window handle');
      return null;
    }

    // Apply liquid glass effect
    const glassId = liquidGlass.addView(handle, {
      cornerRadius: 12,
      tintColor: '#00000015', // Very subtle dark tint for glossy look
      opaque: false, // Ensure transparency
    });

    console.log('[LiquidGlass] Successfully applied liquid glass effect, ID:', glassId);

    // Try setting glass material variant to 'regular' for standard glossy appearance
    try {
      liquidGlass.unstable_setVariant(glassId, liquidGlass.GlassMaterialVariant.regular);
      console.log('[LiquidGlass] Set variant to regular');
    } catch (error) {
      console.warn('[LiquidGlass] Could not set variant:', error);
    }

    return glassId;
  } catch (error) {
    console.error('[LiquidGlass] Error applying liquid glass:', error);
    return null;
  }
}

/**
 * Remove liquid glass effect from a window
 * Note: The electron-liquid-glass library does not provide a removeView method.
 * Glass effects are automatically cleaned up when the window is destroyed.
 * @param glassId The glass ID returned from applyLiquidGlass
 */
export async function removeLiquidGlass(glassId: number | null): Promise<void> {
  // Note: electron-liquid-glass does not provide a removeView API
  // The glass effect is automatically cleaned up when the window is destroyed
  console.log(
    '[LiquidGlass] Glass effect will be cleaned up when window closes, ID:',
    glassId
  );
}

/**
 * Check if liquid glass is supported on the current system
 */
export function isLiquidGlassSupported(): boolean {
  return supportsMacOSLiquidGlass();
}
