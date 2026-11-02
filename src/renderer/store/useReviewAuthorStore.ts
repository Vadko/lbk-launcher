import { create } from 'zustand';
import type {
  NicknameSpin,
  NicknameSpinInput,
  ReviewResult,
} from '@/shared/game-reviews-api-types';
import type { ReviewAuthorIdentity } from '@/shared/game-reviews-types';
import { queryClient } from '../queries/queryClient';
import { reviewAuthorQuery } from '../queries/reviewAuthorQuery';
import { spinNickname } from '../queries/reviewsClient';

type PickedAuthor = ReviewAuthorIdentity | null;
type SpinResult = ReviewResult<NicknameSpin>;

interface ReviewAuthorStore {
  // The server's latest spin for this machine in this session, so a reopened picker shows it instead of spending a new one
  lastSpin: NicknameSpin | null;
  lastSpinAt: number | null;
  isPickerOpen: boolean;
  // Every caller waiting on the open picker shares it
  waiting: PromiseWithResolvers<PickedAuthor> | null;
  // Kept beyond the picker, so an answer still lands after it closed, and a second picker (StrictMode's double start in dev) joins it
  spinning: Promise<SpinResult> | null;
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

// Under the server's 24 h claim window, so a claim started on a kept spin still lands in time
const KEEP_SPIN_MS = 23 * 60 * 60 * 1000;

const forgetLookup = () =>
  void queryClient.invalidateQueries({ queryKey: reviewAuthorQuery.queryKey });

export const useReviewAuthorStore = create<ReviewAuthorStore>((set, get) => {
  const openPicker = () => {
    const waiting = get().waiting ?? Promise.withResolvers<PickedAuthor>();
    set({ waiting, isPickerOpen: true });
    return waiting.promise;
  };
  const settleWaiting = (author: PickedAuthor) => {
    get().waiting?.resolve(author);
    set({ waiting: null });
  };

  return {
    lastSpin: null,
    lastSpinAt: null,
    isPickerOpen: false,
    waiting: null,
    spinning: null,

    ensureAuthor: async () => {
      const { waiting } = get();
      if (waiting) {
        return waiting.promise;
      }
      const known = await queryClient.query(reviewAuthorQuery).catch(() => null);
      return known?.author ?? openPicker();
    },

    spin: (input) => {
      const spinning =
        get().spinning ??
        spinNickname(input)
          .then((result) => {
            if (result.ok) {
              set({ lastSpin: result.data, lastSpinAt: Date.now() });
            }
            return result;
          })
          .finally(() => set({ spinning: null }));
      set({ spinning });
      return spinning;
    },

    openingSpin: () => {
      const { spinning, lastSpin, lastSpinAt } = get();
      if (spinning || lastSpinAt === null || Date.now() - lastSpinAt > KEEP_SPIN_MS) {
        return null;
      }
      return lastSpin;
    },

    pickAuthor: (author) => {
      set({ lastSpin: null, lastSpinAt: null });
      settleWaiting(author);
      forgetLookup();
    },

    closePicker: () => {
      set({ isPickerOpen: false });
      settleWaiting(null);
    },

    forgetAuthor: forgetLookup,
  };
});
