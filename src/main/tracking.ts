/**
 * Централізований модуль для трекінгу подій
 * - Завантаження
 * - Підписки
 * - Кліки на "Підтримати"
 * - Сесії лаунчера
 * - Видалення українізаторів
 *
 * Використовує Supabase Edge Functions через supabase.functions.invoke().
 * Machine ID використовується для ідентифікації користувача
 */

import { app } from 'electron';
import { existsSync, readFileSync } from 'fs';
import { machineIdSync } from 'node-machine-id';
import { join } from 'path';
import type { TrackingResponse } from '../shared/api-config';
import { readFunctionsErrorBody } from './db/functions-error';
import { getSupabaseClient } from './db/supabase-client';
import { getLogFileDirectory } from './utils/logger';

type ArchiveType = 'text' | 'voice' | 'achievements';

interface GetSignedDownloadUrlParams {
  gameId: string;
  archivePath: string;
  archiveType?: ArchiveType;
  isFirstSession?: boolean;
}

// Disable all tracking during E2E tests
const IS_E2E = process.env['LBK_E2E'] === '1' || process.argv.includes('--e2e');

// Session ID for current launcher session
let currentSessionId: string | null = null;

// Flag to check if this is the first launch
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

type TrackPayload = Record<string, unknown>;
type TrackResult = TrackingResponse & { sessionId?: string; isFirstLaunch?: boolean };

/**
 * Викликати edge function `track` з заданим payload.
 */
async function invokeTrack(body: TrackPayload): Promise<TrackResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke<TrackResult>('track', { body });

  if (error) {
    console.error('[Tracking] Failed to call track:', error);
    return { success: false, error: error.message };
  }

  return data ?? { success: false, error: 'Empty response' };
}

/**
 * Отримати signed URL для завантаження архіву
 * Edge Function перевіряє rate-limit і генерує тимчасовий URL
 */
export async function getSignedDownloadUrl(
  params: GetSignedDownloadUrlParams
): Promise<GetSignedUrlResponse> {
  if (IS_E2E) {
    return { success: false, error: 'E2E mode' };
  }
  const { gameId, archivePath, archiveType = 'text', isFirstSession = false } = params;

  // Get machine ID for unique downloads tracking (not for rate limiting)
  const machineId = getMachineId();

  try {
    console.log(
      `[Tracking] Requesting signed URL for game: ${gameId}, type: ${archiveType}`
    );

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke<{
      success: boolean;
      downloadUrl?: string;
      expiresIn?: number;
      error?: string;
    }>('get-download-url', {
      body: {
        gameId,
        archivePath,
        archiveType,
        machineId, // For unique downloads statistics
        isFirstSession, // For first session conversion tracking
      },
    });

    if (error) {
      const httpError = await readFunctionsErrorBody(error);
      if (httpError?.status === 429) {
        // Rate limit exceeded
        console.warn(`[Tracking] Rate limit exceeded for game: ${gameId}`);
        return {
          success: false,
          error: 'rate_limit_exceeded',
          downloadsToday: Number(httpError.body.downloadsToday) || 0,
          maxAllowed: Number(httpError.body.maxAllowed) || 2,
          nextAvailableAt: (httpError.body.nextAvailableAt as string | null) ?? null,
        };
      }
      console.error('[Tracking] Failed to get signed URL:', error);
      return { success: false, error: error.message };
    }

    if (!data?.success || !data.downloadUrl || data.expiresIn === undefined) {
      console.error('[Tracking] Failed to get signed URL:', data);
      return { success: false, error: data?.error || 'Unknown error' };
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
  if (IS_E2E) {
    return { success: false, error: 'E2E mode' } as TrackingResponse;
  }
  const machineId = getMachineId();
  if (!machineId) {
    console.warn('[Tracking] Could not get machine ID, skipping subscription tracking');
    return { success: false, error: 'Machine ID not available' };
  }

  console.log(`[Tracking] Tracking ${action} for game:`, gameId);

  const result = await invokeTrack({
    type: 'subscription',
    gameId,
    userIdentifier: machineId,
    action,
  });
  console.log('[Tracking] Subscription tracking response:', result);
  return result;
}

/**
 * Track support button click
 */
export async function trackSupportClick(gameId: string): Promise<TrackingResponse> {
  if (IS_E2E) {
    return { success: false, error: 'E2E mode' } as TrackingResponse;
  }
  const machineId = getMachineId();
  if (!machineId) {
    console.warn('[Tracking] Could not get machine ID, skipping support click tracking');
    return { success: false, error: 'Machine ID not available' };
  }

  console.log(`[Tracking] Tracking support click for game:`, gameId);

  const result = await invokeTrack({
    type: 'support_click',
    gameId,
    userIdentifier: machineId,
  });
  console.log('[Tracking] Support click tracking response:', result);
  return result;
}

/**
 * Track session start (when launcher opens)
 * The server determines is_first_launch
 * and returns it in the response.
 */
export async function trackSessionStart(appVersion: string): Promise<TrackingResponse> {
  if (IS_E2E) {
    return { success: false, error: 'E2E mode' } as TrackingResponse;
  }
  const machineId = getMachineId();
  if (!machineId) {
    console.warn('[Tracking] Could not get machine ID, skipping session tracking');
    return { success: false, error: 'Machine ID not available' };
  }

  console.log(`[Tracking] Starting session, version: ${appVersion}`);

  const result = await invokeTrack({
    type: 'session_start',
    userIdentifier: machineId,
    appVersion,
  });

  if (result.success && result.sessionId) {
    currentSessionId = result.sessionId;
    isFirstLaunch = result.isFirstLaunch ?? false;
    console.log(
      `[Tracking] Session started: ${currentSessionId}, first launch: ${isFirstLaunch}`
    );
  }

  return result;
}

/**
 * Track session end (when launcher closes)
 */
export async function trackSessionEnd(): Promise<TrackingResponse> {
  if (IS_E2E) {
    return { success: false, error: 'E2E mode' } as TrackingResponse;
  }
  if (!currentSessionId) {
    console.warn('[Tracking] No current session ID, skipping session end tracking');
    return { success: false, error: 'No session ID' };
  }

  const machineId = getMachineId();
  if (!machineId) {
    return { success: false, error: 'Machine ID not available' };
  }

  console.log(`[Tracking] Ending session: ${currentSessionId}`);

  const result = await invokeTrack({
    type: 'session_end',
    userIdentifier: machineId,
    sessionId: currentSessionId,
  });
  console.log('[Tracking] Session end response:', result);

  currentSessionId = null;
  return result;
}

/**
 * Track translation uninstall
 */
export async function trackUninstall(gameId: string): Promise<TrackingResponse> {
  if (IS_E2E) {
    return { success: false, error: 'E2E mode' } as TrackingResponse;
  }
  const machineId = getMachineId();
  if (!machineId) {
    console.warn('[Tracking] Could not get machine ID, skipping uninstall tracking');
    return { success: false, error: 'Machine ID not available' };
  }

  console.log(`[Tracking] Tracking uninstall for game:`, gameId);

  const result = await invokeTrack({
    type: 'uninstall',
    gameId,
    userIdentifier: machineId,
  });
  console.log('[Tracking] Uninstall tracking response:', result);
  return result;
}

/**
 * Track failed search (query with 0 results)
 */
export async function trackFailedSearch(query: string): Promise<TrackingResponse> {
  if (IS_E2E) {
    return { success: false, error: 'E2E mode' } as TrackingResponse;
  }
  const machineId = getMachineId();
  if (!machineId) {
    console.warn('[Tracking] Could not get machine ID, skipping failed search tracking');
    return { success: false, error: 'Machine ID not available' };
  }

  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return { success: false, error: 'Query too short' };
  }

  console.log(`[Tracking] Tracking failed search: "${trimmed}"`);

  const result = await invokeTrack({
    type: 'failed_search',
    query: trimmed,
    source: 'launcher',
    userIdentifier: machineId,
  });
  console.log('[Tracking] Failed search tracking response:', result);
  return result;
}

/**
 * Submit feedback for a game translation
 */
export async function submitFeedback(
  gameId: string,
  type: string,
  message: string,
  screenshotPaths?: string[]
): Promise<{ success: boolean; error?: string }> {
  if (IS_E2E) {
    return { success: false, error: 'E2E mode' };
  }
  const machineId = getMachineId();
  if (!machineId) {
    console.warn('[Tracking] Could not get machine ID, skipping feedback submission');
    return { success: false, error: 'Machine ID not available' };
  }

  try {
    console.log(`[Tracking] Submitting feedback for game: ${gameId}`);

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke<{
      success: boolean;
      error?: string;
    }>('submit-feedback', {
      body: {
        gameId,
        machineId,
        type,
        message,
        ...(screenshotPaths?.length && { screenshotPaths }),
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
      },
    });

    if (error) {
      const httpError = await readFunctionsErrorBody(error);
      if (httpError?.status === 429) {
        console.warn('[Tracking] Feedback rate limit exceeded');
        return { success: false, error: 'rate_limit' };
      }
      console.error('[Tracking] Feedback submission failed:', error);
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      console.error('[Tracking] Feedback submission failed:', data);
      return { success: false, error: data?.error || 'Unknown error' };
    }

    console.log('[Tracking] Feedback submitted successfully');
    return { success: true };
  } catch (error) {
    console.error('[Tracking] Failed to submit feedback:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Submit logs
 */
export async function submitLogs(
  message: string,
  crashReason?: string
): Promise<{ success: boolean; error?: string }> {
  if (IS_E2E) {
    return { success: false, error: 'E2E mode' };
  }
  const machineId = getMachineId();
  if (!machineId) {
    console.warn('[Tracking] Could not get machine ID, skipping logs submission');
    return { success: false, error: 'Machine ID not available' };
  }

  try {
    console.log('[Tracking] Submitting logs');

    const supabase = getSupabaseClient();

    // Read the log file
    const logsDir = getLogFileDirectory();
    const logFilePath = join(
      logsDir,
      `lbk-${new Date().toISOString().split('T')[0]}.log`
    );

    // Upload log file to Storage via signed URL
    let logPath: string | undefined;
    if (existsSync(logFilePath)) {
      const fileName = `lbk-${new Date().toISOString().split('T')[0]}.log`;

      // Get signed upload URL
      const { data: urlResult } = await supabase.functions.invoke<{
        success: boolean;
        signedUrl?: string;
        path?: string;
      }>('submit-logs?action=upload-url', {
        body: { machineId, fileName },
      });

      if (urlResult?.success && urlResult.signedUrl) {
        // Upload the file (PUT напряму на signed URL Storage — не edge function)
        const fileBuffer = readFileSync(logFilePath);
        const uploadResponse = await fetch(urlResult.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body: fileBuffer,
        });

        if (uploadResponse.ok) {
          logPath = urlResult.path;
          console.log(`[Tracking] Log file uploaded: ${logPath}`);
        } else {
          console.warn('[Tracking] Log file upload failed, continuing without file');
        }
      }
    }

    // Submit log entry
    const { data, error } = await supabase.functions.invoke<{
      success: boolean;
      error?: string;
    }>('submit-logs', {
      body: {
        machineId,
        message,
        ...(crashReason && { crashReason }),
        ...(logPath && { logPath }),
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
      },
    });

    if (error) {
      const httpError = await readFunctionsErrorBody(error);
      if (httpError?.status === 429) {
        console.warn('[Tracking] Logs submission rate limit exceeded');
        return { success: false, error: 'rate_limit' };
      }
      console.error('[Tracking] Logs submission failed:', error);
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      console.error('[Tracking] Logs submission failed:', data);
      return { success: false, error: data?.error || 'Unknown error' };
    }

    console.log('[Tracking] Logs submitted successfully');
    return { success: true };
  } catch (error) {
    console.error('[Tracking] Failed to submit logs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get signed upload URLs for feedback screenshots
 */
export async function getFeedbackUploadUrls(fileNames: string[]): Promise<{
  success: boolean;
  uploadUrls?: { fileName: string; path: string; signedUrl: string; token: string }[];
  error?: string;
}> {
  if (IS_E2E) {
    return { success: false, error: 'E2E mode' };
  }
  const machineId = getMachineId();
  if (!machineId) {
    return { success: false, error: 'Machine ID not available' };
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke<{
      success: boolean;
      uploadUrls?: { fileName: string; path: string; signedUrl: string; token: string }[];
      error?: string;
    }>('submit-feedback?action=upload-urls', {
      body: { machineId, fileNames },
    });

    if (error || !data?.success) {
      return {
        success: false,
        error: error?.message || data?.error || 'Failed to get upload URLs',
      };
    }

    return { success: true, uploadUrls: data.uploadUrls };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Upload a local file to a signed URL
 */
export async function uploadFileToSignedUrl(
  signedUrl: string,
  filePath: string,
  contentType: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const fs = await import('node:fs');
    const fileBuffer = fs.readFileSync(filePath);

    const response = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: fileBuffer,
    });

    if (!response.ok) {
      return { success: false, error: `Upload failed: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload error',
    };
  }
}

/**
 * Check if current session is first session (for download tracking)
 */
export function isCurrentSessionFirstLaunch(): boolean {
  return isFirstLaunch;
}

// ============================================================================
// Playtime Tracking
// ============================================================================

interface PlaytimeData {
  gameId: string;
  steamAppId: number;
  deltaMinutes: number;
}

/**
 * Track playtime for multiple games (batch)
 * Called when launcher closes with playtime changes
 */
export async function trackPlaytime(
  playtimeData: PlaytimeData[]
): Promise<TrackingResponse> {
  if (IS_E2E) {
    return { success: false, error: 'E2E mode' } as TrackingResponse;
  }
  if (playtimeData.length === 0) {
    return { success: true };
  }

  const machineId = getMachineId();
  if (!machineId) {
    console.warn('[Tracking] Could not get machine ID, skipping playtime tracking');
    return { success: false, error: 'Machine ID not available' };
  }

  console.log(`[Tracking] Tracking playtime for ${playtimeData.length} games`);

  const result = await invokeTrack({
    type: 'playtime',
    userIdentifier: machineId,
    playtimeData,
  });
  console.log('[Tracking] Playtime tracking response:', result);
  return result;
}
