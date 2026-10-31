// Where a notification click leads: the game page, or one review entry in its thread
export interface GameLinkTarget {
  gameId: string;
  feedbackId?: string;
  entryId?: string;
}

export interface SystemNotificationOptions {
  title: string;
  body: string;
  target?: GameLinkTarget;
}

export interface SystemNotificationAPI {
  showSystemNotification: (options: SystemNotificationOptions) => Promise<boolean>;
  onNavigateToGame: (callback: (target: GameLinkTarget) => void) => () => void;
}

// window.windowControls takes these from the interface the preload implements, so the two cannot drift
declare global {
  interface WindowControlsAPI {
    showSystemNotification: SystemNotificationAPI['showSystemNotification'];
    onNavigateToGame: SystemNotificationAPI['onNavigateToGame'];
  }
}
