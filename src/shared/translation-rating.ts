import type { Game } from './types';

type RatedTranslation = Pick<
  Game,
  'ai' | 'likes' | 'downloads' | 'reviews' | 'translation_progress'
>;

// A like rate every translation starts from, worth this many downloads, so a few early likes do not top the list
const PRIOR_DOWNLOADS = 70;
const PRIOR_LIKE_RATE = 0.1;

const MANUAL_QUALITY = 1;
const EDITED_AI_QUALITY = 0.8;
const RAW_AI_QUALITY = 0.55;

const isManual = (ai: string | null) => ai === null;

function translationQuality(ai: string | null): number {
  if (isManual(ai)) {
    return MANUAL_QUALITY;
  }
  return ai === 'edited' ? EDITED_AI_QUALITY : RAW_AI_QUALITY;
}

// A negative counter would put a log10 of zero or less into the sum, as it would in the SQL copy
const counter = (value: number | null) => Math.max(value ?? 0, 0);

// lbk-admin's translation_rating() and the landing's translationRating() compute the same; change all three together
export function translationRating(
  translation: Omit<RatedTranslation, 'translation_progress'>
): number {
  const likes = counter(translation.likes);
  const downloads = counter(translation.downloads);
  const reviews = counter(translation.reviews);
  const likeScore =
    (likes + PRIOR_DOWNLOADS * PRIOR_LIKE_RATE) / (downloads + PRIOR_DOWNLOADS);
  return (
    0.45 * likeScore +
    0.25 * translationQuality(translation.ai) +
    0.2 * Math.log10(downloads + 1) +
    0.1 * Math.log10(reviews + 1)
  );
}

// Manual translations first, then AI ones, each by its rating
export function compareTranslationRank(a: RatedTranslation, b: RatedTranslation): number {
  return (
    Number(!isManual(a.ai)) - Number(!isManual(b.ai)) ||
    translationRating(b) - translationRating(a) ||
    b.translation_progress - a.translation_progress
  );
}
