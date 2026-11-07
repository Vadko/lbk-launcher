import type { RunInstallerDecision, RunInstallerRequest } from '@/shared/types';

interface PendingPrompt {
  request: RunInstallerRequest;
  resolve: (decision: RunInstallerDecision) => void;
}

// One pending install per game, so a prompt is keyed by its game id.
const pending = new Map<string, PendingPrompt>();

// The skip button's answer with the preselected Proton: the install is recorded and its installer can run later.
function declined(request: RunInstallerRequest): RunInstallerDecision {
  return { run: false, protonPath: request.protonPath };
}

export function answerRunInstaller(gameId: string, decision: RunInstallerDecision): void {
  const prompt = pending.get(gameId);
  if (prompt) {
    pending.delete(gameId);
    prompt.resolve(decision);
  }
}

// The page that could answer is gone (reload, crash, closed window): nothing may wait on it.
export function declinePendingRunInstallers(): void {
  for (const [gameId, { request }] of pending) {
    answerRunInstaller(gameId, declined(request));
  }
}

// `show` answers false when there is no page to show the prompt on.
export function askRunInstaller(
  request: RunInstallerRequest,
  show: (request: RunInstallerRequest) => boolean
): Promise<RunInstallerDecision> {
  const previous = pending.get(request.gameId);
  if (previous) {
    answerRunInstaller(request.gameId, declined(previous.request));
  }
  const { promise, resolve } = Promise.withResolvers<RunInstallerDecision>();
  pending.set(request.gameId, { request, resolve });
  if (!show(request)) {
    answerRunInstaller(request.gameId, declined(request));
  }
  return promise;
}
