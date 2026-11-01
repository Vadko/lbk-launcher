import { useMachine } from '@xstate/react';
import { Check } from 'lucide';
import { InfoIcon } from 'lucide-react';
import React, { useEffect } from 'react';
import { fromPromise } from 'xstate';
import { t } from '@/shared/i18n/i18n';
import { useActionPhase } from '../../../hooks/useActionPhase';
import { usePrefetchCaptcha } from '../../../hooks/usePrefetchCaptcha';
import { claimNickname } from '../../../queries/reviewsClient';
import { useReviewAuthorStore } from '../../../store/useReviewAuthorStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { AppActionIcon } from '../../ui/AppActionIcon';
import { SetupButton, SetupFooter, SetupFrame } from '../SteamPluginSetup/SetupParts';
import { reviewAuthorPickerMachine } from './reviewAuthorPickerMachine';
import { SlotMachine } from './SlotMachine';

// Mounted by MainLayout after the other modals, so it is the top dialog for the gamepad and covers FeedbackModal
export const ReviewAuthorPicker: React.FC = () => {
  const pickAuthor = useReviewAuthorStore((s) => s.pickAuthor);
  const closePicker = useReviewAuthorStore((s) => s.closePicker);
  const animate = useSettingsStore((s) => s.animationsEnabled);
  const claimPhase = useActionPhase();
  const [snapshot, send] = useMachine(
    reviewAuthorPickerMachine.provide({
      actors: {
        claim: fromPromise(({ input: claim }) =>
          claimPhase.run(() => claimNickname(claim), {
            // author_exists means the machine has a nickname already, which the picker then takes
            isSuccess: (result) => result.ok || result.failure.code === 'author_exists',
          })
        ),
      },
    }),
    // useMachine reads its input once, when the picker opens
    {
      input: {
        spin: useReviewAuthorStore.getState().openingSpin(),
        animate,
        spinsLeft: useReviewAuthorStore.getState().spinsLeft,
      },
    }
  );
  const { spin, heldSpin, holds, moving, pulledAt, notice, spinsLeft, won, refused } =
    snapshot.context;
  const isIdle = snapshot.matches('idle');
  const isSpinning = snapshot.matches('spinning') || snapshot.matches('landing');
  const isClaimed = snapshot.status === 'done';
  const isClaiming = snapshot.matches('claiming') || snapshot.matches('resolvingAuthor');
  const isBusy = isClaiming || isClaimed;
  const canClaim = isIdle && spin !== null && !refused;
  const isOutOfSpins = spinsLeft === 0;

  usePrefetchCaptcha('nickname', canClaim);

  useEffect(() => {
    if (snapshot.status === 'done' && snapshot.output) {
      pickAuthor(snapshot.output);
    }
  }, [pickAuthor, snapshot.output, snapshot.status]);

  // The callers already have the author; the dialog stays until the claim's check mark has shown
  useEffect(() => {
    if (isClaimed && !claimPhase.isBusy) {
      closePicker();
    }
  }, [claimPhase.isBusy, closePicker, isClaimed]);

  const body = (
    <div className="flex flex-col gap-4.5">
      <SlotMachine
        spin={spin}
        heldSpin={heldSpin}
        holds={holds}
        moving={moving}
        pulledAt={pulledAt}
        isSpinning={isSpinning}
        isWon={won}
        notice={notice}
        canHold={isIdle && spin !== null && !isOutOfSpins}
        canPull={isIdle && !isOutOfSpins}
        spinsLeft={spinsLeft}
        animate={animate}
        onToggleHold={(reel) => send({ type: 'TOGGLE_HOLD', reel })}
        onPull={() => send({ type: 'PULL' })}
      />
      <p className="flex items-start gap-2 rounded-lg border border-color-accent/30 bg-color-accent/10 px-3 py-2 text-sm text-text-main">
        <InfoIcon size={16} className="mt-0.5 shrink-0 text-color-accent" />
        {t('reviewAuthorPicker.permanent')}
      </p>
    </div>
  );

  const footer = (
    <SetupFooter>
      <SetupButton
        tone="secondary"
        onClick={closePicker}
        disabled={isBusy}
        gamepad="cancel"
      >
        {t('common.cancel')}
      </SetupButton>
      {/* Busy rather than disabled while the reels move, so the gamepad focus stays on it */}
      <SetupButton
        tone="primary"
        onClick={() => send({ type: 'CLAIM' })}
        disabled={isIdle && !canClaim}
        busy={!isIdle}
        gamepad="confirm"
        icon={
          <AppActionIcon phase={claimPhase.phase} icon={Check} size={16} inheritColor />
        }
      >
        {t('reviewAuthorPicker.claim')}
      </SetupButton>
    </SetupFooter>
  );

  return (
    <SetupFrame
      view={{
        title: t('reviewAuthorPicker.title'),
        description: t('reviewAuthorPicker.intro'),
        dismissable: !isBusy,
        body,
        footer,
      }}
      className="review-author-dialog"
      seamlessHeader
      onClose={closePicker}
    />
  );
};
