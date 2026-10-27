import { assign, fromPromise, setup } from 'xstate';
import type {
  NicknameClaimInput,
  NicknameSpin,
  NicknameSpinInput,
  ReviewAuthorState,
  ReviewFailure,
  ReviewResult,
} from '@/shared/game-reviews-api-types';
import type { ReviewAuthorIdentity } from '@/shared/game-reviews-types';
import { claimNickname, fetchReviewAuthor } from '../../../queries/reviewsClient';
import { useReviewAuthorStore } from '../../../store/useReviewAuthorStore';
import { isHoldLocked } from './isHoldLocked';
import { FAILURE_NOTICE, type PickerNotice } from './pickerNotice';
import { type ReelSchedule, reelSchedule } from './slotReelMotion';
import {
  ALL_REELS,
  anyReel,
  NO_REELS,
  type ReelFlags,
  type SlotReelId,
} from './slotReels';

type FailureCode = ReviewFailure['code'];

interface PickerContext {
  // The machine's latest live spin, the one a claim or a hold names
  spin: NicknameSpin | null;
  // What the held reels show until the pull lands: the server may re-inflect a held adjective for the new noun
  heldSpin: NicknameSpin | null;
  holds: ReelFlags;
  // Reels that spun in the latest pull; a held one stays put
  spun: ReelFlags;
  moving: ReelFlags;
  pulledAt: number;
  schedule: ReelSchedule;
  notice: PickerNotice | null;
  author: ReviewAuthorIdentity | null;
  animate: boolean;
}

interface PickerInput {
  spin: NicknameSpin | null;
  animate: boolean;
}

type PickerEvent =
  | { type: 'PULL' }
  | { type: 'TOGGLE_HOLD'; reel: SlotReelId }
  | { type: 'CLAIM' };

const codeOf = (result: ReviewResult<unknown>): FailureCode | null =>
  result.ok ? null : result.failure.code;

// A lost or broken answer may follow a spin that did commit, so the spin id kept here can be stale
const UNKNOWN_OUTCOME: ReadonlySet<FailureCode> = new Set([
  'internal',
  'unreachable',
  'bad_response',
]);

const unheld = (holds: ReelFlags): ReelFlags => ({
  avatar: !holds.avatar,
  adjective: !holds.adjective,
  noun: !holds.noun,
});

// The clash may be the avatar seed, and two held words would ask for the taken name again
const holdsAfterTaken = (holds: ReelFlags): ReelFlags => ({
  avatar: false,
  adjective: holds.adjective && !holds.noun,
  noun: holds.noun,
});

const holdsWord = (holds: ReelFlags) => holds.adjective || holds.noun;

const NO_SCHEDULE: ReelSchedule = {
  settle: { avatar: 0, adjective: 0, noun: 0 },
  landed: 0,
};

export const reviewAuthorPickerMachine = setup({
  types: {
    context: {} as PickerContext,
    events: {} as PickerEvent,
    input: {} as PickerInput,
    output: {} as ReviewAuthorIdentity | null,
  },
  actors: {
    spin: fromPromise<ReviewResult<NicknameSpin>, NicknameSpinInput>(({ input }) =>
      useReviewAuthorStore.getState().spin(input)
    ),
    claim: fromPromise<ReviewResult<ReviewAuthorIdentity>, NicknameClaimInput>(
      ({ input }) => claimNickname(input)
    ),
    author: fromPromise<ReviewResult<ReviewAuthorState>>(() => fetchReviewAuthor()),
  },
  actions: {
    stopReel: assign({
      moving: ({ context }, params: { reel: SlotReelId }) => ({
        ...context.moving,
        [params.reel]: false,
      }),
    }),
  },
  guards: {
    hasSpin: ({ context }) => context.spin !== null,
  },
  delays: {
    settleAvatar: ({ context }) => context.schedule.settle.avatar,
    settleAdjective: ({ context }) => context.schedule.settle.adjective,
    settleNoun: ({ context }) => context.schedule.settle.noun,
    landed: ({ context }) => context.schedule.landed,
  },
}).createMachine({
  id: 'reviewAuthorPicker',
  context: ({ input }) => ({
    spin: input.spin,
    heldSpin: null,
    holds: NO_REELS,
    spun: NO_REELS,
    moving: NO_REELS,
    pulledAt: 0,
    schedule: NO_SCHEDULE,
    notice: null,
    author: null,
    animate: input.animate,
  }),
  output: ({ context }) => context.author,
  initial: 'opening',
  states: {
    // A spin kept from an earlier open is still claimable, so it is shown instead of spending a new one
    opening: {
      always: [{ guard: 'hasSpin', target: 'idle' }, { target: 'spinning' }],
    },
    spinning: {
      entry: assign(({ context }) => {
        const spun = context.spin ? unheld(context.holds) : ALL_REELS;
        return { pulledAt: Date.now(), spun, moving: spun };
      }),
      invoke: {
        src: 'spin',
        input: ({ context }) => ({
          spinId: context.spin?.spinId ?? null,
          hold: context.spin ? context.holds : NO_REELS,
        }),
        onDone: [
          {
            guard: ({ event }) => event.output.ok,
            target: 'landing',
            actions: assign(({ context, event }) =>
              event.output.ok
                ? {
                    spin: event.output.data,
                    heldSpin: context.spin,
                    schedule: reelSchedule(Date.now() - context.pulledAt, context.moving),
                  }
                : {}
            ),
          },
          {
            guard: ({ event }) => codeOf(event.output) === 'author_exists',
            target: 'resolvingAuthor',
          },
          {
            guard: ({ context, event }) =>
              codeOf(event.output) === 'invalid_hold' && anyReel(context.holds),
            target: 'spinning',
            reenter: true,
            actions: assign({ holds: NO_REELS, notice: 'holdsReleased' }),
          },
          {
            guard: ({ context, event }) =>
              codeOf(event.output) === 'nicknames_exhausted' && holdsWord(context.holds),
            target: 'spinning',
            reenter: true,
            actions: assign({
              holds: ({ context }) => ({
                ...context.holds,
                adjective: false,
                noun: false,
              }),
              notice: 'wordsReleased',
            }),
          },
          {
            target: 'idle',
            actions: assign(({ context, event }) => {
              const code = codeOf(event.output) ?? 'internal';
              return {
                moving: NO_REELS,
                notice: FAILURE_NOTICE[code],
                holds: UNKNOWN_OUTCOME.has(code) ? NO_REELS : context.holds,
              };
            }),
          },
        ],
        onError: {
          target: 'idle',
          actions: assign({ moving: NO_REELS, notice: 'failed' }),
        },
      },
    },
    // The reels stop one by one; with animations off they are already still
    landing: {
      exit: assign({ heldSpin: null }),
      always: {
        guard: ({ context }) => !context.animate || context.schedule.landed === 0,
        target: 'idle',
        actions: assign({ moving: NO_REELS }),
      },
      after: {
        settleAvatar: { actions: { type: 'stopReel', params: { reel: 'avatar' } } },
        settleAdjective: { actions: { type: 'stopReel', params: { reel: 'adjective' } } },
        settleNoun: { actions: { type: 'stopReel', params: { reel: 'noun' } } },
        landed: { target: 'idle', actions: assign({ moving: NO_REELS }) },
      },
    },
    idle: {
      on: {
        PULL: { target: 'spinning', actions: assign({ notice: null }) },
        TOGGLE_HOLD: {
          guard: ({ context, event }) =>
            context.spin !== null && !isHoldLocked(context.holds, event.reel),
          actions: assign({
            holds: ({ context, event }) => ({
              ...context.holds,
              [event.reel]: !context.holds[event.reel],
            }),
          }),
        },
        CLAIM: { guard: 'hasSpin', target: 'claiming' },
      },
    },
    claiming: {
      entry: assign({ notice: null }),
      invoke: {
        src: 'claim',
        input: ({ context }) => ({ spinId: context.spin?.spinId ?? '' }),
        onDone: [
          {
            guard: ({ event }) => event.output.ok,
            target: 'done',
            actions: assign({
              author: ({ event }) => (event.output.ok ? event.output.data : null),
            }),
          },
          {
            guard: ({ event }) => codeOf(event.output) === 'nickname_taken',
            target: 'spinning',
            actions: assign({
              holds: ({ context }) => holdsAfterTaken(context.holds),
              notice: 'nameTaken',
            }),
          },
          {
            guard: ({ event }) => codeOf(event.output) === 'invalid_candidate',
            target: 'spinning',
            actions: assign({ holds: NO_REELS, notice: 'nameExpired' }),
          },
          {
            guard: ({ event }) => codeOf(event.output) === 'author_exists',
            target: 'resolvingAuthor',
          },
          {
            target: 'idle',
            actions: assign({
              notice: ({ event }) => FAILURE_NOTICE[codeOf(event.output) ?? 'internal'],
            }),
          },
        ],
        onError: { target: 'idle', actions: assign({ notice: 'failed' }) },
      },
    },
    // The machine already has a nickname, which the failed call did not carry
    resolvingAuthor: {
      invoke: {
        src: 'author',
        onDone: [
          {
            guard: ({ event }) => event.output.ok && event.output.data.author !== null,
            target: 'done',
            actions: assign({
              author: ({ event }) => (event.output.ok ? event.output.data.author : null),
            }),
          },
          {
            target: 'idle',
            actions: assign({
              moving: NO_REELS,
              notice: ({ event }) => FAILURE_NOTICE[codeOf(event.output) ?? 'internal'],
            }),
          },
        ],
        onError: {
          target: 'idle',
          actions: assign({ moving: NO_REELS, notice: 'failed' }),
        },
      },
    },
    done: { type: 'final' },
  },
});
