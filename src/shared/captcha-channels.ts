// Free of imports: the sandboxed captcha preload can require nothing but electron
export const CAPTCHA_CHANNELS = {
  request: 'captcha:request',
  ready: 'captcha:ready',
  unavailable: 'captcha:unavailable',
  resolve: 'captcha:resolve',
  reject: 'captcha:reject',
} as const;
