import { Download, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useChangelogStore } from '../../store/useChangelogStore';
import { useGamepadModeStore } from '../../store/useGamepadModeStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import {
  APP_UPDATE_GAME_ID,
  useSubscriptionsStore,
} from '../../store/useSubscriptionsStore';
import { Modal } from '../Modal/Modal';

interface UpdateInfo {
  version?: string;
  downloadUrl?: string;
}

export const UpdateNotification = () => {
  const { appUpdateNotificationsEnabled } = useSettingsStore();
  const isGamepadMode = useGamepadModeStore((s) => s.isGamepadMode);
  const changelogEntries = useChangelogStore((s) => s.entries);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const notifiedVersionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }

    // Listen for update events
    const unsubAvailable = window.electronAPI.onUpdateAvailable(async (info) => {
      console.log('Update available:', info);
      const update = info as UpdateInfo;
      const newVersion = update?.version;

      if (newVersion) {
        void useChangelogStore.getState().loadForVersion(newVersion);
      }

      if (appUpdateNotificationsEnabled) {
        setUpdateAvailable(true);
        setUpdateInfo(update);

        // Додати в історію сповіщень (тільки один раз для кожної версії)
        if (newVersion && notifiedVersionRef.current !== newVersion) {
          notifiedVersionRef.current = newVersion;

          const currentVersion = await window.electronAPI.getVersion();
          const { addAppUpdateNotification, hasNotifiedVersion } =
            useSubscriptionsStore.getState();

          if (!hasNotifiedVersion(APP_UPDATE_GAME_ID, newVersion)) {
            addAppUpdateNotification(currentVersion, newVersion);
          }
        }
      }
    });

    const unsubDownloaded = window.electronAPI.onUpdateDownloaded((info) => {
      console.log('Update downloaded:', info);
      setUpdateDownloaded(true);
      setDownloading(false);
    });

    const unsubProgress = window.electronAPI.onUpdateProgress((progressInfo) => {
      setProgress(Math.round(progressInfo.percent || 0));
    });

    const unsubError = window.electronAPI.onUpdateError((error) => {
      console.error('Update error:', error);
      setDownloading(false);
    });

    return () => {
      unsubAvailable?.();
      unsubDownloaded?.();
      unsubProgress?.();
      unsubError?.();
    };
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await window.electronAPI.downloadUpdate();
    } catch (error) {
      console.error('Update download failed:', error);
      setDownloading(false);
    }
  };

  const handleInstall = () => {
    useSubscriptionsStore.getState().markAppUpdateNotificationsAsRead();
    window.electronAPI.installUpdate();
  };

  const externalDownloadUrl = updateInfo?.downloadUrl;
  const pendingVersion = updateInfo?.version;
  const pendingEntry = changelogEntries.find((entry) => entry.version === pendingVersion);

  const handleOpenExternal = () => {
    if (!externalDownloadUrl) {
      return;
    }
    useSubscriptionsStore.getState().markAppUpdateNotificationsAsRead();
    window.electronAPI.openExternal(externalDownloadUrl);
    setUpdateAvailable(false);
  };

  if (!appUpdateNotificationsEnabled || (!updateAvailable && !updateDownloaded)) {
    return null;
  }

  const content = (
    <>
      <p className="text-gray-400 text-sm mb-3">
        {updateDownloaded
          ? 'Оновлення завантажено та готове до встановлення'
          : `Версія ${pendingVersion || 'нова'} доступна для завантаження`}
      </p>
      {pendingEntry && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-text-main mb-1">
            {pendingEntry.title}
          </p>
          <ul
            className={`list-disc list-inside space-y-1 ${
              isGamepadMode ? '' : 'max-h-32 overflow-y-auto'
            }`}
          >
            {pendingEntry.highlights.map((item, index) => (
              <li
                key={`${pendingEntry.version}-${index}`}
                className="text-xs text-gray-400"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      {downloading && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Завантаження...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-color-main transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </>
  );

  const buttons = (
    <div className="flex gap-2">
      {externalDownloadUrl ? (
        <button
          onClick={handleOpenExternal}
          data-gamepad-confirm
          className="flex-1 px-4 py-2 bg-color-main hover:brightness-110 text-black rounded-lg transition-colors"
        >
          Скачати нову версію
        </button>
      ) : updateDownloaded ? (
        <button
          onClick={handleInstall}
          data-gamepad-confirm
          className="flex-1 px-4 py-2 bg-color-main hover:brightness-110 text-black rounded-lg transition-colors"
        >
          Перезапустити
        </button>
      ) : (
        <button
          onClick={handleDownload}
          disabled={downloading}
          data-gamepad-confirm
          className="flex-1 px-4 py-2 bg-color-main hover:brightness-110 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {downloading ? 'Завантаження...' : 'Завантажити'}
        </button>
      )}
      {!updateDownloaded && (
        <button
          onClick={() => setUpdateAvailable(false)}
          data-gamepad-cancel
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Пізніше
        </button>
      )}
    </div>
  );

  // In gamepad mode, show as modal for better navigation
  if (isGamepadMode) {
    return (
      <Modal
        isOpen={true}
        onClose={() => setUpdateAvailable(false)}
        title={updateDownloaded ? 'Оновлення готове!' : 'Доступне оновлення'}
        footer={buttons}
        showCloseButton={!updateDownloaded}
      >
        {content}
      </Modal>
    );
  }

  // Normal floating toast notification
  return (
    <div className="fixed bottom-4 right-4 glass-panel notification-toast border border-color-accent rounded-xl p-4 shadow-xl max-w-sm z-50">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          {downloading ? (
            <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
          ) : (
            <Download className="w-5 h-5 text-blue-400" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-white font-semibold mb-1">
            {updateDownloaded ? 'Оновлення готове!' : 'Доступне оновлення'}
          </h3>
          {content}
          {buttons}
        </div>
      </div>
    </div>
  );
};
