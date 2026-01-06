import { create } from 'zustand';

interface ModalConfig {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  actions?: ModalAction[];
  onClose?: () => void;
}

export interface ModalAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

interface ModalStore {
  isOpen: boolean;
  config: ModalConfig | null;
  showModal: (config: ModalConfig) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalStore>((set, get) => ({
  isOpen: false,
  config: null,

  showModal: (config) => {
    set({ isOpen: true, config });
  },

  closeModal: () => {
    const { config } = get();
    config?.onClose?.();
    set({ isOpen: false, config: null });
  },
}));
