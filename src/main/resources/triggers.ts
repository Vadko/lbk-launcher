import { isDeepStrictEqual } from 'node:util';
import {
  onRendererSettingsChanged,
  readRendererSetting,
} from '@/main/utils/store-storage';
import type { ResourceTrigger } from './define-resource';

// The renderer rewrites its whole settings envelope whenever any field changes
export const setting =
  (field: string): ResourceTrigger =>
  (fire) => {
    const read = () => readRendererSetting<unknown>(field, undefined);
    const last = { value: read() };
    onRendererSettingsChanged(() => {
      const value = read();
      if (!isDeepStrictEqual(value, last.value)) {
        last.value = value;
        fire();
      }
    });
  };
