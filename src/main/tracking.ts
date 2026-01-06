/**
 * Централізований модуль для трекінгу подій (завантаження, підписки)
 * Використовує Supabase Edge Functions
 * Machine ID використовується для ідентифікації користувача
 */

import { machineIdSync } from 'node-machine-id';
import type { TrackingResponse } from '../shared/api-config';

type ArchiveType = 'text' | 'voice' | 'achievements';

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
  gameId: string,
  archivePath: string,
  archiveType: ArchiveType = 'text'
): Promise<GetSignedUrlResponse> {
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
