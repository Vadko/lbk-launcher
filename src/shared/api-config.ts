/**
 * Types for the tracking API
 */

export interface TrackingResponse {
  success: boolean;
  downloads?: number;
  subscriptions?: number;
  error?: string;
}
