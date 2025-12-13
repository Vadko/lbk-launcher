/**
 * Типи для API трекінгу
 */

export interface TrackingResponse {
  success: boolean;
  downloads?: number;
  subscriptions?: number;
  error?: string;
}
