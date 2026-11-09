import { ReviewReveal } from './ReviewReveal';
import { THREAD_LINE } from './reviewThreadLine';

// A branch hangs from the centre of its parent's avatar: 40px for the review, 28px for a reply
const BRANCH = {
  review: { row: 'pl-14', line: 'left-5', curve: 'left-5 w-5' },
  reply: { row: 'pl-11', line: 'left-3.5', curve: 'left-3.5 w-3.5' },
};

export type BranchLevel = keyof typeof BRANCH;

interface ReviewThreadRowProps {
  level: BranchLevel;
  isLast: boolean;
  isToggle: boolean;
  children: React.ReactNode;
}

// The 12px corner ends at the vertical centre of the reply's avatar or of the toggle button
export function ReviewThreadRow({
  level,
  isLast,
  isToggle,
  children,
}: ReviewThreadRowProps) {
  const branch = BRANCH[level];
  // Padding lives inside, since a padded box cannot shrink below it and would jump in
  return (
    <ReviewReveal>
      <div className={`relative ${branch.row} ${isToggle ? 'pt-2' : 'pt-4'}`}>
        <span
          aria-hidden
          className={`${THREAD_LINE} ${branch.line} top-0 ${isLast ? (isToggle ? 'h-3' : 'h-4.5') : 'bottom-0'}`}
        />
        <span
          aria-hidden
          className={`${THREAD_LINE} ${branch.curve} h-3 border-b rounded-bl-xl ${isToggle ? 'top-3' : 'top-4.5'}`}
        />
        {children}
      </div>
    </ReviewReveal>
  );
}
