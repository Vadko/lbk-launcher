import { startAchievementPage } from '@lbk/bridge-core/achievement-page';
import { appStringsInFile } from '@lbk/bridge-core/achievement-page-sources';
import { matchAchievementPage } from '@lbk/bridge-core/achievement-page-url';
import { F, O } from '@mobily/ts-belt';
import { ownScriptUrl, scriptPath } from '../shared/own-script-url';

// Read at most once per document; LBK rewrites the file whenever installed translations change.
const achievementsFile = (scriptUrl: string) =>
  F.once((): Promise<unknown> => {
    const url = new URL('achievements.json', scriptUrl);
    url.searchParams.set('t', String(Date.now()));
    return fetch(url.href, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  });

// Millennium runs this in every Steam web page, so anything but an achievements page leaves at once.
export default function WebkitMain(): void {
  if (!matchAchievementPage(window.location.href)) {
    return;
  }
  O.match(
    ownScriptUrl('webkit.js'),
    (url) => {
      const read = achievementsFile(url);
      startAchievementPage({
        provider: (appid) => read().then((file) => appStringsInFile(file, appid)),
      });
    },
    () =>
      console.warn(
        `[LBK] No script tag ends with ${scriptPath('webkit.js')}; achievements.json cannot be found`
      )
  );
}
