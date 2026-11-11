import { D } from '@mobily/ts-belt';
import { create } from 'zustand';

interface ReplyDraft {
  entryId: string;
  text: string;
}

type ById<T> = Partial<Record<string, T>>;

interface ReviewDraftsStore {
  // Per thread: the entry its reply composer is open under, with what was typed
  replies: ById<ReplyDraft>;
  // Per entry: the text of its open edit
  edits: ById<string>;
  // The draft the player has just opened, whose composer takes focus once on mount
  focusRequest: string | null;
  takeFocusRequest: (draftKey: string) => void;
  openReply: (threadId: string, entryId: string) => void;
  setReplyText: (threadId: string, text: string) => void;
  closeReply: (threadId: string) => void;
  openEdit: (entryId: string, text: string) => void;
  setEditText: (entryId: string, text: string) => void;
  closeEdit: (entryId: string) => void;
}

export const replyDraftKey = (threadId: string) => `reply:${threadId}`;
export const editDraftKey = (entryId: string) => `edit:${entryId}`;

const without = <T>(dict: ById<T>, id: string): ById<T> =>
  D.rejectWithKey(dict, (key) => key === id);

// Drafts live until they are sent or discarded, so a remount or a visit elsewhere keeps them
export const useReviewDraftsStore = create<ReviewDraftsStore>((set) => ({
  replies: {},
  edits: {},
  focusRequest: null,

  takeFocusRequest: (draftKey) =>
    set((state) => (state.focusRequest === draftKey ? { focusRequest: null } : state)),

  openReply: (threadId, entryId) =>
    set((state) =>
      state.replies[threadId]?.entryId === entryId
        ? state
        : {
            replies: { ...state.replies, [threadId]: { entryId, text: '' } },
            focusRequest: replyDraftKey(threadId),
          }
    ),
  setReplyText: (threadId, text) =>
    set((state) => {
      const draft = state.replies[threadId];
      return draft
        ? { replies: { ...state.replies, [threadId]: { ...draft, text } } }
        : state;
    }),
  closeReply: (threadId) =>
    set((state) => ({ replies: without(state.replies, threadId) })),

  openEdit: (entryId, text) =>
    set((state) =>
      state.edits[entryId] === undefined
        ? {
            edits: { ...state.edits, [entryId]: text },
            focusRequest: editDraftKey(entryId),
          }
        : state
    ),
  setEditText: (entryId, text) =>
    set((state) => ({ edits: { ...state.edits, [entryId]: text } })),
  closeEdit: (entryId) => set((state) => ({ edits: without(state.edits, entryId) })),
}));
