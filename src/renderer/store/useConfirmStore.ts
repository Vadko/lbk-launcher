import { create } from 'zustand';

interface ConfirmConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ConfirmStore {
  isOpen: boolean;
  config: ConfirmConfig | null;
  showConfirm: (config: ConfirmConfig) => void;
  closeConfirm: () => void;
  confirm: () => void;
}

export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  isOpen: false,
  config: null,

  showConfirm: (config) => {
    set({ isOpen: true, config });
  },

  closeConfirm: () => {
    const { config } = get();
    config?.onCancel?.();
    set({ isOpen: false, config: null });
  },

  confirm: () => {
    const { config } = get();
    config?.onConfirm();
    set({ isOpen: false, config: null });
  },
}));
