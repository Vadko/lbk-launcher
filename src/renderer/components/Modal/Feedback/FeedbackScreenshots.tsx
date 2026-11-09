import { ImageIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Trans } from 'react-i18next';
import { t } from '@/shared/i18n/i18n';

const MAX_SCREENSHOTS = 5;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export interface ScreenshotFile {
  name: string;
  file: File;
  type: string;
  previewUrl: string;
}

interface FeedbackScreenshotsProps {
  screenshots: ScreenshotFile[];
  onChange: React.Dispatch<React.SetStateAction<ScreenshotFile[]>>;
}

export function FeedbackScreenshots({ screenshots, onChange }: FeedbackScreenshotsProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      for (const s of screenshots) {
        URL.revokeObjectURL(s.previewUrl);
      }
    },
    [screenshots]
  );

  const addFiles = (files: FileList | File[]) => {
    const newFiles: ScreenshotFile[] = [];

    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        continue;
      }
      if (screenshots.length + newFiles.length >= MAX_SCREENSHOTS) {
        break;
      }

      newFiles.push({
        name: file.name,
        file,
        type: file.type,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (newFiles.length > 0) {
      onChange((prev) => [...prev, ...newFiles]);
    }
  };

  const removeScreenshot = (index: number) => {
    onChange((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  return (
    <div>
      <p className="text-sm font-medium text-text-muted mb-3">
        {t('feedbackModal.screenshotsLabel')}
      </p>

      {screenshots.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {screenshots.map((s, i) => (
            <div key={s.previewUrl} className="relative group">
              <img
                src={s.previewUrl}
                alt={s.name}
                className="w-16 h-16 object-cover rounded-lg border border-border"
              />
              <button
                onClick={() => removeScreenshot(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <XIcon size={12} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {screenshots.length < MAX_SCREENSHOTS && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-lg border border-dashed cursor-pointer transition-all ${
            isDragOver
              ? 'border-color-main bg-color-main/5'
              : 'border-border bg-glass hover:border-border-hover'
          }`}
        >
          <ImageIcon size={24} className="text-text-muted" />
          <p className="text-sm text-text-muted">
            <Trans
              i18nKey="feedbackModal.dropzone"
              components={{ hl: <span className="font-semibold text-color-main" /> }}
            />
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            addFiles(e.target.files);
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}
