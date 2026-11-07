import { create } from 'zustand';

interface SelectOption {
  name: string;
  value: string;
}

interface ModalConfig {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  actions?: ModalAction[];
  onClose?: () => void;
  selectConfig?: {
    options: SelectOption[];
    selectedValue?: string;
    onSelectionChange?: (value: string) => void;
    placeholder?: string;
  };
  /**
   * Hide the close (X) button, the backdrop dismiss, and the implicit
   * "Скасувати" fallback so the user MUST pick one of the listed actions.
   */
  mandatory?: boolean;
  // A showModal with the same key replaces this modal where it is, shown or queued.
  key?: string;
}

export interface ModalAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  /** Run onClick without closing the modal — for actions like "open folder". */
  keepOpen?: boolean;
}

interface ModalStore {
  isOpen: boolean;
  config: ModalConfig | null;
  // A mandatory modal waits for its answer, so nothing replaces it and it replaces nothing: they queue.
  queue: ModalConfig[];
  showModal: (config: ModalConfig) => void;
  closeModal: () => void;
}

const sameFlow = (a: ModalConfig, b: ModalConfig) =>
  a.key !== undefined && a.key === b.key;

export const useModalStore = create<ModalStore>((set, get) => ({
  isOpen: false,
  config: null,
  queue: [],

  showModal: (config) => {
    const { config: current, queue } = get();
    if (current && sameFlow(current, config)) {
      set({ config });
      return;
    }
    const queued = queue.findIndex((waiting) => sameFlow(waiting, config));
    if (queued !== -1) {
      set({ queue: queue.with(queued, config) });
      return;
    }
    if (current && (current.mandatory || config.mandatory)) {
      set({ queue: [...queue, config] });
      return;
    }
    set({ isOpen: true, config });
  },

  closeModal: () => {
    const { config, queue } = get();
    config?.onClose?.();
    const [next = null, ...rest] = queue;
    set({ isOpen: next !== null, config: next, queue: rest });
  },
}));
