import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';

export const UpdateNotification = () => {
  const { appUpdateNotificationsEnabled } = useSettingsStore();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [updateInfo, setUpdateInfo] = useState<unknown>(null);

  useEffect(() => {
    if (!window.electronAPI) return;

    // Listen for update events
    window.electronAPI.onUpdateAvailable((info) => {
      console.log('Update available:', info);
      if (appUpdateNotificationsEnabled) {
        setUpdateAvailable(true);
        setUpdateInfo(info);
      }
    });

    window.electronAPI.onUpdateDownloaded((info) => {
      console.log('Update downloaded:', info);
      setUpdateDownloaded(true);
      setDownloading(false);
    });

    window.electronAPI.onUpdateProgress((progressInfo) => {
      setProgress(Math.round(progressInfo.percent || 0));
    });

    window.electronAPI.onUpdateError((error) => {
      console.error('Update error:', error);
      setDownloading(false);
    });
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    await window.electronAPI.downloadUpdate();
  };

  const handleInstall = () => {
    window.electronAPI.installUpdate();
  };

  if (!appUpdateNotificationsEnabled || (!updateAvailable && !updateDownloaded)) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl max-w-sm">
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
          <p className="text-gray-400 text-sm mb-3">
            {updateDownloaded
              ? 'Оновлення завантажено та готове до встановлення'
              : `Версія ${(updateInfo as { version?: string })?.version || 'нова'} доступна для завантаження`}
          </p>
          {downloading && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Завантаження...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            {updateDownloaded ? (
              <button
                onClick={handleInstall}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                Перезапустити
              </button>
            ) : (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {downloading ? 'Завантаження...' : 'Завантажити'}
              </button>
            )}
            {!updateDownloaded && (
              <button
                onClick={() => setUpdateAvailable(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Пізніше
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
