import { create } from 'zustand';
import type {
  NicknameSpin,
  NicknameSpinInput,
  ReviewResult,
} from '@/shared/game-reviews-api-types';
import type { ReviewAuthorIdentity } from '@/shared/game-reviews-types';
import { allGameReviewsQueryKey } from '../queries/gameReviewsQueryKey';
import { queryClient } from '../queries/queryClient';
import { fetchReviewAuthor, spinNickname } from '../queries/reviewsClient';
import { type ReviewPages, withViewer } from '../utils/reviewCache';

type PickedAuthor = ReviewAuthorIdentity | null;
type SpinResult = ReviewResult<NicknameSpin>;

interface ReviewAuthorStore {
  // This machine's nickname, null until it is known or claimed
  author: ReviewAuthorIdentity | null;
  // The server's latest spin for this machine in this session, so a reopened picker shows it instead of spending a new one
  lastSpin: NicknameSpin | null;
  lastSpinAt: number | null;
  isPickerOpen: boolean;
  // Resolves with the nickname, opening the picker when there is none; null when the picker was closed, or when the signal aborted before it opened
  ensureAuthor: (signal?: AbortSignal) => Promise<PickedAuthor>;
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

// Optimistic writes read the nickname from the cached pages, which were fetched before the claim
function rememberAuthor(set: Set_, author: ReviewAuthorIdentity): void {
  set({ author });
  queryClient.setQueriesData<ReviewPages>(
    { queryKey: allGameReviewsQueryKey },
    (data) => data && withViewer(data, author)
  );
}

// A failed lookup answers null too, so the picker still opens: its spin answers author_exists when a nickname is there
function lookUpAuthor(set: Set_): Promise<PickedAuthor> {
  lookup ??= fetchReviewAuthor()
    .then((known) => {
      if (known.ok && known.data.author) {
        rememberAuthor(set, known.data.author);
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
  isPickerOpen: false,

  ensureAuthor: async (signal) => {
    const { author } = get();
    if (author) {
      return author;
    }
    if (picker) {
      return picker;
    }
    const known = await lookUpAuthor(set);
    // A caller whose composer closed during the lookup opens no picker, since a picker spends a spin as it opens
    if (known || signal?.aborted) {
      return known;
    }
    return openPicker(set);
  },

  spin: (input) => {
    spinRequest ??= spinNickname(input)
      .then((result) => {
        if (result.ok) {
          set({ lastSpin: result.data, lastSpinAt: Date.now() });
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
    rememberAuthor(set, author);
    set({ lastSpin: null, lastSpinAt: null });
    settleCallers(author);
  },

  closePicker: () => {
    set({ isPickerOpen: false });
    settleCallers(null);
  },

  forgetAuthor: () => set({ author: null }),
}));
