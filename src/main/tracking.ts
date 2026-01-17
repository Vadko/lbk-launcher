/**
 * Централізований модуль для трекінгу подій
 * - Завантаження
 * - Підписки
 * - Кліки на "Підтримати"
 * - Сесії лаунчера
 * - Видалення українізаторів
 *
 * Використовує Supabase Edge Functions
 * Machine ID використовується для ідентифікації користувача
 */

import { machineIdSync } from 'node-machine-id';
import type { TrackingResponse } from '../shared/api-config';

type ArchiveType = 'text' | 'voice' | 'achievements';

interface GetSignedDownloadUrlParams {
  gameId: string;
  archivePath: string;
  archiveType?: ArchiveType;
  isFirstSession?: boolean;
}

// Session ID for current launcher session
let currentSessionId: string | null = null;

// Flag to check if this is the first launch
let isFirstLaunchChecked = false;
let isFirstLaunch = false;

interface SignedUrlResult {
  success: true;
  downloadUrl: string;
  expiresIn: number;
}

interface SignedUrlRateLimitError {
  success: false;
  error: 'rate_limit_exceeded';
  downloadsToday: number;
  maxAllowed: number;
  nextAvailableAt: string | null;
}

interface SignedUrlError {
  success: false;
  error: string;
}

type GetSignedUrlResponse = SignedUrlResult | SignedUrlRateLimitError | SignedUrlError;

let cachedMachineId: string | null = null;

/**
 * Отримати machine ID (з кешуванням)
 */
export function getMachineId(): string | null {
  if (cachedMachineId) {
    return cachedMachineId;
  }

  try {
    cachedMachineId = machineIdSync();
    return cachedMachineId;
  } catch (error) {
    console.error('[Tracking] Error getting machine ID:', error);
    return null;
  }
}

/**
 * Отримати signed URL для завантаження архіву
 * Edge Function перевіряє rate-limit і генерує тимчасовий URL
 */
export async function getSignedDownloadUrl(
  params: GetSignedDownloadUrlParams
): Promise<GetSignedUrlResponse> {
  const { gameId, archivePath, archiveType = 'text', isFirstSession = false } = params;

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[Tracking] Missing Supabase credentials');
    return { success: false, error: 'Missing Supabase credentials' };
  }

  // Get machine ID for unique downloads tracking (not for rate limiting)
  const machineId = getMachineId();

  try {
    console.log(
      `[Tracking] Requesting signed URL for game: ${gameId}, type: ${archiveType}`
    );

    const response = await fetch(`${SUPABASE_URL}/functions/v1/get-download-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        gameId,
        archivePath,
        archiveType,
        machineId, // For unique downloads statistics
        isFirstSession, // For first session conversion tracking
      }),
    });

    const data = await response.json();

    if (response.status === 429) {
      // Rate limit exceeded
      console.warn(`[Tracking] Rate limit exceeded for game: ${gameId}`);
      return {
        success: false,
        error: 'rate_limit_exceeded',
        downloadsToday: data.downloadsToday || 0,
        maxAllowed: data.maxAllowed || 2,
        nextAvailableAt: data.nextAvailableAt || null,
      };
    }

    if (!response.ok || !data.success) {
      console.error(`[Tracking] Failed to get signed URL:`, data);
      return { success: false, error: data.error || 'Unknown error' };
    }

    console.log(`[Tracking] Got signed URL, expires in ${data.expiresIn}s`);
    return {
      success: true,
      downloadUrl: data.downloadUrl,
      expiresIn: data.expiresIn,
    };
  } catch (error) {
    console.error('[Tracking] Error getting signed URL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Трекінг підписки на гру
 */
export async function trackSubscription(
  gameId: string,
  action: 'subscribe' | 'unsubscribe'
): Promise<TrackingResponse> {
  const machineId = getMachineId();
  if (!machineId) {
    console.warn('[Tracking] Could not get machine ID, skipping subscription tracking');
    return { success: false, error: 'Machine ID not available' };
  }

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[Tracking] Missing Supabase credentials');
    return { success: false, error: 'Missing Supabase credentials' };
  }

  try {
    console.log(`[Tracking] Tracking ${action} for game:`, gameId);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        type: 'subscription',
        gameId,
        userIdentifier: machineId,
        action,
      }),
    });

    const result = (await response.json()) as TrackingResponse;
    console.log('[Tracking] Subscription tracking response:', result);

    return result;
  } catch (error) {
    console.error('[Tracking] Failed to track subscription:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Track support button click
 */
export async function trackSupportClick(gameId: string): Promise<TrackingResponse> {
  const machineId = getMachineId();
  if (!machineId) {
    console.warn('[Tracking] Could not get machine ID, skipping support click tracking');
    return { success: false, error: 'Machine ID not available' };
  }

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[Tracking] Missing Supabase credentials');
    return { success: false, error: 'Missing Supabase credentials' };
  }

  try {
    console.log(`[Tracking] Tracking support click for game:`, gameId);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        type: 'support_click',
        gameId,
        userIdentifier: machineId,
      }),
    });

    const result = (await response.json()) as TrackingResponse;
    console.log('[Tracking] Support click tracking response:', result);

    return result;
  } catch (error) {
    console.error('[Tracking] Failed to track support click:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check if this is the first launch of the app (no previous sessions)
 */
async function checkIsFirstLaunch(): Promise<boolean> {
  if (isFirstLaunchChecked) {
    return isFirstLaunch;
  }

  const machineId = getMachineId();
  if (!machineId) {
    isFirstLaunchChecked = true;
    isFirstLaunch = false;
    return false;
  }

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    isFirstLaunchChecked = true;
    isFirstLaunch = false;
    return false;
  }

  try {
    // Check if there are any previous sessions for this machine
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/launcher_sessions?user_identifier=eq.${machineId}&limit=1`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    const data = await response.json();
    isFirstLaunch = !data || data.length === 0;
    isFirstLaunchChecked = true;

    console.log(`[Tracking] First launch check: ${isFirstLaunch}`);
    return isFirstLaunch;
  } catch (error) {
    console.error('[Tracking] Failed to check first launch:', error);
    isFirstLaunchChecked = true;
    isFirstLaunch = false;
    return false;
  }
}

/**
 * Track session start (when launcher opens)
 */
export async function trackSessionStart(appVersion: string): Promise<TrackingResponse> {
  const machineId = getMachineId();
  if (!machineId) {
    console.warn('[Tracking] Could not get machine ID, skipping session tracking');
    return { success: false, error: 'Machine ID not available' };
  }

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[Tracking] Missing Supabase credentials');
    return { success: false, error: 'Missing Supabase credentials' };
  }

  try {
    // Check if this is the first launch before recording
    const firstLaunch = await checkIsFirstLaunch();

    console.log(
      `[Tracking] Starting session, version: ${appVersion}, first launch: ${firstLaunch}`
    );

    const response = await fetch(`${SUPABASE_URL}/functions/v1/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        type: 'session_start',
        userIdentifier: machineId,
        appVersion,
        isFirstLaunch: firstLaunch,
      }),
    });

    const result = (await response.json()) as TrackingResponse & { sessionId?: string };

    if (result.success && result.sessionId) {
      currentSessionId = result.sessionId;
      console.log(`[Tracking] Session started: ${currentSessionId}`);
    }

    return result;
  } catch (error) {
    console.error('[Tracking] Failed to track session start:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Track session end (when launcher closes)
 */
export async function trackSessionEnd(): Promise<TrackingResponse> {
  if (!currentSessionId) {
    console.warn('[Tracking] No current session ID, skipping session end tracking');
    return { success: false, error: 'No session ID' };
  }

  const machineId = getMachineId();
  if (!machineId) {
    return { success: false, error: 'Machine ID not available' };
  }

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, error: 'Missing Supabase credentials' };
  }

  try {
    console.log(`[Tracking] Ending session: ${currentSessionId}`);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        type: 'session_end',
        userIdentifier: machineId,
        sessionId: currentSessionId,
      }),
    });

    const result = (await response.json()) as TrackingResponse;
    console.log('[Tracking] Session end response:', result);

    currentSessionId = null;
    return result;
  } catch (error) {
    console.error('[Tracking] Failed to track session end:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Track translation uninstall
 */
export async function trackUninstall(gameId: string): Promise<TrackingResponse> {
  const machineId = getMachineId();
  if (!machineId) {
    console.warn('[Tracking] Could not get machine ID, skipping uninstall tracking');
    return { success: false, error: 'Machine ID not available' };
  }

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[Tracking] Missing Supabase credentials');
    return { success: false, error: 'Missing Supabase credentials' };
  }

  try {
    console.log(`[Tracking] Tracking uninstall for game:`, gameId);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        type: 'uninstall',
        gameId,
        userIdentifier: machineId,
      }),
    });

    const result = (await response.json()) as TrackingResponse;
    console.log('[Tracking] Uninstall tracking response:', result);

    return result;
  } catch (error) {
    console.error('[Tracking] Failed to track uninstall:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check if current session is first session (for download tracking)
 */
export function isCurrentSessionFirstLaunch(): boolean {
  return isFirstLaunch;
}
