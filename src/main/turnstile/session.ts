import { F } from '@mobily/ts-belt';
import { type Session, session } from 'electron';

// No 'persist:' prefix: Cloudflare's state stays in memory and ends with the app
const PARTITION = 'lbk-captcha';

export const captchaSession = F.once((): Session => {
  const captcha = session.fromPartition(PARTITION);
  // Electron grants every permission a session has no handler for
  captcha.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
  captcha.setPermissionCheckHandler(() => false);
  captcha.setDevicePermissionHandler(() => false);
  // Without a save path Electron asks with a native Save dialog, whose file the remote page names
  captcha.on('will-download', (event) => {
    event.preventDefault();
  });
  return captcha;
});
