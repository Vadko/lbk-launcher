const reported = new Set<string>();

// A broken captcha page fails every public write, so each cause is an error (a Sentry event) once per run and a warning after
export function reportCaptchaFault(cause: string): void {
  const first = !reported.has(cause);
  reported.add(cause);
  console[first ? 'error' : 'warn'](`[Turnstile] Captcha page: ${cause}`);
}
