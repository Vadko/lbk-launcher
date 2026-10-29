import { errorMessage } from '@/shared/errors';
import { fail } from './fail';

// A guard passes its self-test only by failing with its own message, never by tripping over something else
export function rejectsWith(label: string, run: () => unknown, expected: RegExp): void {
  let message: string | undefined;
  try {
    run();
  } catch (error) {
    message = errorMessage(error);
  }
  if (message === undefined) {
    fail(`self-test: ${label} was accepted`);
  }
  if (!expected.test(message)) {
    fail(`self-test: ${label} was rejected by "${message}" instead of ${expected}`);
  }
}
