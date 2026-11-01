import { create } from 'zustand';
import type {
  NicknameSpin,
  NicknameSpinInput,
  ReviewResult,
} from '@/shared/game-reviews-api-types';
import type { ReviewAuthorIdentity } from '@/shared/game-reviews-types';
import { fetchReviewAuthor, spinNickname } from '../queries/reviewsClient';

type PickedAuthor = ReviewAuthorIdentity | null;
type SpinResult = ReviewResult<NicknameSpin>;

interface ReviewAuthorStore {
  // This machine's nickname, null until it is known or claimed
  author: ReviewAuthorIdentity | null;
  // The server's latest spin for this machine in this session, so a reopened picker shows it instead of spending a new one
  lastSpin: NicknameSpin | null;
  lastSpinAt: number | null;
  // Spins the server still allows this machine this hour, null until a lookup or a spin tells; at 0 the lever locks
  spinsLeft: number | null;
  isPickerOpen: boolean;
  // Resolves with the nickname, opening the picker when there is none; null when the picker was closed
  ensureAuthor: () => Promise<PickedAuthor>;
  spin: (input: NicknameSpinInput) => Promise<SpinResult>;
  // The spin a picker opens on: none while a spin is on its way (the picker joins it) or once it is too old to claim
  openingSpin: () => NicknameSpin | null;
  // Hands the claimed nickname to the callers; the picker closes on its own once the claim's check mark has shown
  pickAuthor: (author: ReviewAuthorIdentity) => void;
  // Callers still waiting get null, and the composer that asked keeps its text
  closePicker: () => void;
  // The server answered author_required, so the nickname known here is gone
  forgetAuthor: () => void;
}

type Set_ = (partial: Partial<ReviewAuthorStore>) => void;

// Shared by every caller while one lookup, or one picker, is open
let lookup: Promise<PickedAuthor> | null = null;
let picker: Promise<PickedAuthor> | null = null;
let settlePicker: ((author: PickedAuthor) => void) | null = null;

// Under the server's 24 h claim window, so a claim started on a kept spin still lands in time
const KEEP_SPIN_MS = 23 * 60 * 60 * 1000;

// Kept outside the picker, so an answer still lands after the picker closed, and a second picker (StrictMode's double start in dev) joins it
let spinRequest: Promise<SpinResult> | null = null;

// A failed lookup answers null too, so the picker still opens: its spin answers author_exists when a nickname is there
function lookUpAuthor(set: Set_): Promise<PickedAuthor> {
  lookup ??= fetchReviewAuthor()
    .then((known) => {
      if (known.ok) {
        set({ spinsLeft: known.data.spinsLeft });
      }
      if (known.ok && known.data.author) {
        set({ author: known.data.author });
        return known.data.author;
      }
      return null;
    })
    .finally(() => {
      lookup = null;
    });
  return lookup;
}

function openPicker(set: Set_): Promise<PickedAuthor> {
  picker ??= new Promise<PickedAuthor>((resolve) => {
    set({ isPickerOpen: true });
    settlePicker = resolve;
  }).finally(() => {
    picker = null;
  });
  return picker;
}

function settleCallers(author: PickedAuthor): void {
  const settle = settlePicker;
  settlePicker = null;
  settle?.(author);
}

export const useReviewAuthorStore = create<ReviewAuthorStore>((set, get) => ({
  author: null,
  lastSpin: null,
  lastSpinAt: null,
  spinsLeft: null,
  isPickerOpen: false,

  ensureAuthor: async () => {
    const { author } = get();
    if (author) {
      return author;
    }
    if (picker) {
      return picker;
    }
    return (await lookUpAuthor(set)) ?? openPicker(set);
  },

  spin: (input) => {
    spinRequest ??= spinNickname(input)
      .then((result) => {
        if (result.ok) {
          set({
            lastSpin: result.data,
            lastSpinAt: Date.now(),
            spinsLeft: result.data.spinsLeft,
          });
        } else if (result.failure.code === 'rate_limit') {
          set({ spinsLeft: 0 });
        }
        return result;
      })
      .finally(() => {
        spinRequest = null;
      });
    return spinRequest;
  },

  openingSpin: () => {
    const { lastSpin, lastSpinAt } = get();
    if (spinRequest || lastSpinAt === null || Date.now() - lastSpinAt > KEEP_SPIN_MS) {
      return null;
    }
    return lastSpin;
  },

  pickAuthor: (author) => {
    set({ author, lastSpin: null, lastSpinAt: null });
    settleCallers(author);
  },

  closePicker: () => {
    set({ isPickerOpen: false });
    settleCallers(null);
  },

  forgetAuthor: () => set({ author: null }),
}));
