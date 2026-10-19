export const uk = {
  achievementsBadge: {
    settingOffDetail:
      'У налаштуваннях вимкнено «Швидке застосування параметрів запуску Steam» — без нього лаунчер не підключає плагін «LBK Bridge».',
    hidden: 'Не покажуться в Steam',
    millennium: 'Працюватиме через Millennium',
    decky: 'Працюватиме через Decky',
    afterRestart: "З'явиться після перезапуску Steam",
    needsMillennium: 'Потрібен Millennium',
    needsDeckyPlugin: 'Потрібен плагін для Decky',
    needsDecky: 'Потрібен Decky Loader',
  },
  achievementsNote: {
    needsMillennium:
      'Steam більше не показує перекладені досягнення зі звичайних файлів. Щоб встановити переклад досягнень і бачити його в бібліотеці, сповіщеннях та оверлеї Steam, потрібен Millennium. У меню самої гри назви лишаться мовою розробника.',
    needsDeckyPlugin:
      'Steam більше не показує перекладені досягнення зі звичайних файлів. Щоб встановити переклад досягнень і бачити його в бібліотеці, сповіщеннях та оверлеї Steam, потрібен плагін «LBK Bridge» для Decky Loader. У меню самої гри назви лишаться мовою розробника.',
    needsDecky:
      'Steam більше не показує перекладені досягнення зі звичайних файлів. На Steam Deck переклад досягнень показує плагін «LBK Bridge» для Decky Loader, тож спершу потрібен Decky Loader. У меню самої гри назви лишаться мовою розробника.',
    settingOff:
      'Переклад досягнень недоступний, поки вимкнено інтеграцію зі Steam. {{detail}}',
    unsupported:
      'Переклад досягнень недоступний: на цій системі Steam не може його показати. {{detail}}',
  },
  achievementsOption: {
    title: 'Досягнення Steam',
    checking: 'Перевірка…',
    description: 'Переклад досягнень Steam.',
    thirdPartyAuthor: 'Автор перекладу досягнень:',
  },
  adultWarning: {
    title: 'Контент для дорослих',
    message:
      'Ця гра містить контент для дорослих (18+). Щоб переглянути цю гру, увімкніть відповідне налаштування.',
    openSettings: 'Відкрити налаштування',
  },
  bridgeStatus: {
    connected: 'Підключено до Steam.',
    connectedDecky: 'Підключено до Steam через плагін «LBK Bridge» для Decky.',
    connectedMillennium: 'Підключено до Steam через плагін «LBK Bridge» для Millennium.',
    steamNotRunning: 'Steam не запущено.',
    restartPending: 'Щоб увімкнути швидке застосування, перезапустіть Steam один раз.',
    cefBlocked:
      'Steam не відкрив канал для лаунчера навіть після перезапуску, тож лаунчер більше не проситиме перезапускати Steam. Параметри запуску застосовуватимуться після закриття Steam. Можливо, канал блокує інший мод Steam.',
    millenniumOutdated:
      'Виявлено застарілий Millennium 2.x. Оновіть Millennium до версії 3 — тоді лаунчер зможе працювати з ним через плагін. До того параметри запуску застосовуватимуться після закриття Steam.',
  },
  changelog: {
    title: 'Що нового',
    upcoming: 'Буде в оновленні',
    yourVersion: 'Ваша версія — v{{version}}',
    olderVersions: 'Попередні версії ({{total}})',
    fullList: 'Повний список змін на GitHub',
  },
  common: {
    cancel: 'Скасувати',
    selectFolder: 'Вибрати папку',
    error: 'Помилка',
    unknownError: 'Невідома помилка',
    installError: 'Помилка встановлення',
    uninstallError: 'Помилка видалення',
    close: 'Закрити',
    ok: 'Зрозуміло',
    notNow: 'Не зараз',
    dontOfferAgain: 'Більше не пропонувати',
    tryAgain: 'Спробувати ще раз',
    checkingSystem: 'Перевірка системи…',
    restartSteamNow: 'Перезапустити Steam зараз',
    afterSteamExit: 'Після закриття Steam',
  },
  deckyLoader: {
    offerIntro:
      'Decky Loader — безкоштовний сторонній завантажувач плагінів для Steam Deck (не від Valve). Лаунчер може встановити його разом із плагіном «LBK Bridge».',
    offerBenefits:
      'Що це дасть:\n• перекладені досягнення в бібліотеці, сповіщеннях і оверлеї Steam.',
    offerWithout:
      'Що працює й без Decky Loader: параметри запуску, підписки в Майстерні, колекція «З українізаторами», ярлик лаунчера та обкладинки в Steam.',
    offerInstaller:
      'Лаунчер завантажить офіційний інсталятор Decky Loader з GitHub і запустить його. Пароль адміністратора (sudo) інсталятор питає у власному вікні, лаунчер його не бачить. Якщо пароля ще немає, інсталятор запропонує тимчасовий і прибере його після встановлення.',
    offerCaveat:
      'Зважте: після великих оновлень SteamOS Decky Loader іноді доводиться встановити ще раз.',
    repair:
      'Decky Loader встановлено, але він не працює — схоже, попереднє встановлення не завершилося. Лаунчер може запустити офіційний інсталятор Decky Loader ще раз.',
    gameMode:
      'Інсталятор Decky Loader працює лише в режимі робочого столу. Перейдіть у нього через меню живлення Steam, відкрийте лаунчер і натисніть «Встановити Decky Loader» ще раз.',
    installing:
      'Відкрито інсталятор Decky Loader. Введіть пароль адміністратора у вікні «Decky Installer» і оберіть «release». Якщо вікна не видно, знайдіть його на панелі завдань.',
    failure: {
      'download-failed':
        "Не вдалося завантажити інсталятор Decky Loader. Перевірте з'єднання з інтернетом і спробуйте ще раз.",
      'checksum-mismatch':
        'Завантажений інсталятор Decky Loader не збігається з перевіреною версією. Встановлення скасовано.',
      unsupported:
        'На цій системі лаунчер не може встановити Decky Loader. Встановіть його за інструкцією на сайті Decky Loader.',
      'not-running':
        'Decky Loader встановлено, але він не запустився. Спробуйте ще раз — інсталятор перевстановить його.',
      'not-installed':
        'Decky Loader не встановлено. Якщо вікно інсталятора закрито або пароль не підійшов, спробуйте ще раз.',
    },
    whatIs: 'Що таке Decky Loader',
    repairAction: 'Відновити Decky Loader',
    installAction: 'Встановити Decky Loader',
  },
  deckyPlugin: {
    waiting: 'Очікування LBK Launcher',
    connected: 'Підключено до LBK Launcher',
    viaMillennium: 'Працює через Millennium',
  },
  deckySetup: {
    title: 'Плагін «LBK Bridge» для Decky Loader',
    waiting:
      'Підтвердіть встановлення плагіна «LBK Bridge» у вікні Decky Loader. Якщо вікна не видно, натисніть кнопку Steam.',
    fallback:
      'Не вдалося відкрити запит Decky Loader. Збережіть плагін і встановіть його вручну: Decky → Налаштування → Розробник → Install Plugin from ZIP.',
    done: "Плагін «LBK Bridge» встановлено. Переклад досягнень з'явиться в Steam.",
    saveZip: 'Зберегти ZIP',
    saved: 'Файл збережено: {{path}}',
    saveFailed: 'Не вдалося зберегти файл.',
    saveFailedWithError: 'Не вдалося зберегти файл: {{error}}',
    intro:
      'Плагін показує в Steam перекладені досягнення — у бібліотеці, сповіщеннях і оверлеї. Усе інше лаунчер уміє й без нього. Decky Loader покаже запит на встановлення — підтвердьте його в Steam.',
    noDecky:
      'Decky Loader не знайдено. Спершу встановіть Decky Loader — після цього лаунчер зможе додати до нього плагін «LBK Bridge».',
    loaderDone: 'Decky Loader встановлено.',
    pluginReady: 'Плагін «LBK Bridge» для Decky Loader уже встановлено.',
    pluginUpdate: 'Доступне оновлення плагіна «LBK Bridge» для Decky.',
    updatePlugin: 'Оновити плагін для Decky',
    installPlugin: 'Встановити плагін',
  },
  download: {
    paused: 'Завантаження призупинено',
    pauseFailed: 'Не вдалося призупинити завантаження',
    resuming: 'Продовження завантаження...',
    resumeFailed: 'Не вдалося продовжити завантаження',
    cancelled: 'Завантаження скасовано',
    retryAttempt:
      'Спроба {{attempt}}/{{maxRetries}}... Перевірте підключення до Інтернету.',
    downloading: 'Завантаження українізатора...',
    connectionLost: "З'єднання втрачено. Перевірте підключення до Інтернету.",
    networkRetry: 'Помилка мережі. Спроба {{attempt}}/{{maxRetries}}...',
    failedAfterRetries:
      'Не вдалося завантажити файл після {{maxRetries}} спроб.\n\nОстання помилка: {{error}}\n\nПеревірте підключення до Інтернету та спробуйте ще раз.',
    rangeUnsupported: 'Сервер не підтримує продовження, перезапуск...',
    fileChanged: 'Файл на сервері змінився, потрібно перезапустити завантаження',
    timeout: 'Час очікування вичерпано. Перевірте підключення до Інтернету.',
    failed: 'Помилка завантаження',
    httpError: 'Помилка завантаження: HTTP {{statusCode}} {{statusMessage}}',
    noInternet: 'Відсутнє підключення до Інтернету',
    connectFailed:
      'Не вдалося підключитися до сервера. Перевірте підключення до Інтернету.',
    connectionReset: "З'єднання розірвано. Перевірте підключення до Інтернету.",
    serverUnavailable: 'Сервер недоступний',
    serverUnavailableRetry: 'Сервер недоступний. Спробуйте пізніше.',
    failedCheckConnection: 'Помилка завантаження. Перевірте підключення до Інтернету.',
    failedWithError: 'Помилка завантаження: {{error}}',
  },
  duration: {
    underSecond: '< 1с',
  },
  gameActions: {
    play: 'Грати',
    removedFromCatalog: 'Переклад більше не доступний у каталозі',
    offline: 'Відсутнє підключення до Інтернету',
    rerunTitle: 'Запустити інсталятор/скрипт повторно',
    rerun: 'Перевстановити',
    uninstallTitle: 'Видалити українізатор',
    support: 'Підтримати',
    feedback: 'Лишити відгук',
    cancel: 'Скасувати',
  },
  gameAuthors: {
    many: 'Автори локалізації',
    one: 'Автор локалізації',
  },
  gamePage: {
    tombstone:
      'Цей переклад більше не доступний у каталозі. Ви можете лише видалити локалізацію — повторне встановлення недоступне.',
    uninstalling: 'Видалення українізатора та відновлення оригінальних файлів...',
  },
  gameSections: {
    aboutTranslation: 'Про українізатор',
    aboutGame: 'Про гру',
  },
  gameStatus: {
    planned: 'Заплановано',
    inProgress: 'Ранній доступ',
    completed: 'Завершено',
    techImprovement: 'Технічна доробка',
  },
  install: {
    rateLimitTitle: 'Ліміт завантажень',
  },
  installArchive: {
    extracting: 'Розпакування файлів... {{percent}}%',
    extracted: 'Розпакування завершено',
    extractFailed: 'Помилка розпакування архіву: {{error}}',
  },
  installBackup: {
    backupFailed: 'Помилка створення резервної копії: {{error}}',
    restoreFailed: 'Помилка відновлення файлів: {{error}}',
  },
  installButton: {
    offline: 'Немає інтернету',
    planned: 'Заплановано',
    techImprovement: 'Технічна доробка',
    reload: 'Перезавантажити (v{{version}})',
    update: 'Оновити до v{{version}}',
    install: 'Встановити українізатор',
  },
  installComponents: {
    removing: 'Видалення компонентів...',
    removeFailed: 'Не вдалося видалити компоненти',
    removedTitle: 'Компоненти видалено',
    removedMessage: 'Вибрані компоненти успішно видалено.',
  },
  installConflict: {
    title: 'Інша локалізація вже встановлена',
    message:
      'У папці гри вже встановлено іншу локалізацію:\n\n"{{name}}"{{team}}\nВерсія: {{version}}\n\nЩоб встановити нову локалізацію, потрібно спочатку видалити попередню.\n\nВидалити попередню локалізацію?',
    confirm: 'Видалити і продовжити',
    infoNotFound: 'Не вдалося знайти інформацію про встановлену локалізацію.',
    removeFailed: 'Не вдалося видалити попередню локалізацію.',
    unknownLocalization: 'Невідома локалізація',
  },
  installEmulator: {
    title: 'Виберіть папку з грою',
    message:
      'Для емуляторів потрібно вручну вказати папку з грою.\n\nВиберіть папку з грою?',
  },
  installGameNotFound: {
    title: 'Гру не знайдено',
    message: '{{error}}\n\nСпробуйте вибрати папку гри самостійно',
  },
  installIpc: {
    fileNotFound: 'Файл не знайдено',
    pickFolderTitle: 'Виберіть папку з грою',
    pickFolderButton: 'Вибрати',
    noActiveDownload: 'Немає активного завантаження для призупинення',
    noPausedDownload: 'Немає призупиненого завантаження',
  },
  installNetwork: {
    interruptedTitle: "З'єднання перервано",
    interruptedMessage:
      'Не вдалося відновити завантаження автоматично.\n\nПеревірте підключення до Інтернету та спробуйте знову.\nПрогрес завантаження збережено.',
    retry: 'Спробувати знову',
    waiting:
      "З'єднання втрачено. Завантаження продовжиться автоматично після відновлення з'єднання...",
    resuming: 'Відновлення завантаження...',
    offlineTitle: 'Немає підключення',
    offlineMessage: 'Перевірте підключення до Інтернету та спробуйте ще раз.',
  },
  installOptions: {
    reinstallTitle: 'Керування компонентами',
    installTitle: 'Опції встановлення',
    reinstallIntro: 'Оберіть компоненти для "{{name}}":',
    installIntro: 'Виберіть опції для встановлення українізатора "{{name}}":',
    platformAuto: 'Автоматично ({{platform}})',
    platformManual: 'Ручний вибір ({{platform}})',
    platformFound: 'Знайдено',
    platformNotFound: 'Не знайдено (вибір вручну)',
    platformLabel: 'Платформа гри',
    platformPlaceholder: 'Оберіть платформу',
    backupTitle: 'Створити резервну копію',
    backupDescription:
      'Зберегти оригінальні файли гри. Рекомендовано для можливості відновлення.',
    backupSize: 'Орієнтовний розмір: {{size}}',
    textTitle: 'Текстова локалізація',
    installed: 'встановлено',
    textDescription: 'Переклад текстів гри українською.',
    size: 'Розмір: {{size}}',
    willReinstall: 'Буде перевстановлено',
    willInstall: 'Буде встановлено',
    voiceTitle: 'Озвучення',
    unavailable: '(недоступно)',
    voiceWithText: '(разом з текстовою)',
    voiceDescription: 'Українське озвучення.',
    willRemove: 'Буде видалено',
    willDownload: 'Буде завантажено',
    launchOptions:
      'Цей переклад встановить власні <hl>параметри запуску</hl> для гри в Steam.',
    totalDownload: 'Буде завантажено:',
    removeList: 'Буде видалено: {{items}}',
    removeVoice: 'озвучення',
    removeAchievements: 'досягнення',
    confirm: 'Встановити',
  },
  installPlatform: {
    linuxOnly:
      'Цей українізатор доступний тільки для Linux. Встановлення на Windows неможливе.',
    windowsOnly:
      'Цей українізатор доступний тільки для Windows. Встановлення на macOS неможливе.',
    unsafeCmdPath: 'шлях містить символи, небезпечні для командного рядка: {{path}}',
    exitFailedOrCancelled: 'Встановлення завершилось з помилкою або було скасовано',
    exitCancelled: 'Встановлення скасовано',
    exitCode: 'Інсталятор завершився з кодом {{code}}',
    installerOutput: '\n\nВивід інсталятора:\n{{output}}',
    installerFileNotFound: 'файл інсталятора не знайдено: {{path}}',
    launching: 'Запуск інсталятора...',
    protonSetup: 'Налаштування та запуск Proton',
    notCompleted: 'встановлення не було завершене',
    windowsNeedsProton: 'Windows інсталятор ({{extensions}}) потребує Proton.',
    runFailed: 'Не вдалося запустити інсталятор: {{error}}',
    uninstallerFailed: 'Не вдалося запустити деінсталятор: {{error}}',
    rerunFailed: 'Повторний запуск інсталятора не вдався',
  },
  installSteamIntegration: {
    launchOptions: 'Налаштування параметрів запуску Steam...',
    artwork: 'Встановлення українських обкладинок Steam...',
  },
  installSteps: {
    licenseOnlyManual:
      'Встановлення цього перекладу доступне тільки для ліцензійної версії гри.\n\nРучний вибір папки заборонено.',
    licenseOnlyNotFound:
      'Встановлення цього перекладу доступне тільки для ліцензійної версії гри.\n\nГру не знайдено. Переконайтеся, що ліцензійна версія гри встановлена через офіційний магазин (Steam, GOG, Epic Games, Ubisoft Connect, EA App тощо).',
    gameNotFound:
      'Гру не знайдено\n\nМи не змогли автоматично визначити шлях до папки: {{path}}',
    pathNotSpecified: 'не вказано',
    protonMissing:
      'Цей українізатор має Windows-інсталятор, для якого потрібен Proton, але жодної версії не знайдено.\n\nВстановіть Proton у Steam і спробуйте ще раз.',
    notEnoughSpace:
      'Недостатньо місця на диску.\n\nНеобхідно: {{needed}}\nДоступно: {{available}}\n\nЗвільніть місце та спробуйте знову.',
    noArchiveForBuild:
      'Для встановленої збірки гри ({{build}}) немає архіву перекладу.\n\nПереклад доступний лише для: {{variants}}.',
    voiceStatus: 'Озвучення: {{message}}',
    copying: 'Копіювання файлів українізатора...',
    cleaning: 'Очищення тимчасових файлів...',
    backingUp: 'Створення резервної копії...',
    awaitingConfirm_installer: 'Очікування підтвердження запуску інсталятора...',
    awaitingConfirm_script: 'Очікування підтвердження запуску скрипта...',
    runDeclined_installer:
      'Встановлення скасовано: запуск інсталятора було відхилено.\n\nФайли розпаковано в папку гри — ви можете запустити інсталятор пізніше кнопкою «Перевстановити».',
    runDeclined_script:
      'Встановлення скасовано: запуск скрипта було відхилено.\n\nФайли розпаковано в папку гри — ви можете запустити скрипт пізніше кнопкою «Перевстановити».',
    macBundleUnresolved:
      'Не вдалося визначити місце встановлення всередині macOS-бандла (.app).\n\nДля цієї гри потрібен окремий macOS-архів перекладу.',
    status: 'Досягнення: {{message}}',
  },
  installSuccess: {
    updatedMessage: 'Українізатор {{name}} успішно оновлено до версії {{version}}!',
    installedMessage: 'Українізатор {{name}} успішно встановлено!',
    updatedTitle: 'Українізатор оновлено',
    installedTitle: 'Українізатор встановлено',
    pluginNextStart: "Переклад досягнень з'явиться після наступного запуску Steam.",
    needsMillenniumInstallable:
      'Переклад досягнень збережено. Щоб бачити його в Steam, потрібен Millennium — лаунчер може встановити його сам.',
    needsMillennium:
      'Переклад досягнень збережено. Щоб бачити його в Steam, потрібен Millennium.',
    needsDeckyPlugin:
      'Переклад досягнень збережено. Щоб бачити його в Steam, встановіть плагін «LBK Bridge» для Decky Loader.',
    needsDecky:
      'Переклад досягнень збережено. На Steam Deck його показує плагін «LBK Bridge» для Decky Loader — лаунчер може встановити Decky Loader сам.',
    unavailable:
      'Переклад досягнень збережено, але на цій системі Steam не може його показати: {{reason}}',
    disabled:
      'Переклад досягнень збережено. Щоб бачити його в Steam, увімкніть у налаштуваннях «Швидке застосування параметрів запуску Steam».',
    launchOptionsQueued:
      'Параметри запуску застосуються автоматично, щойно ви закриєте Steam. Лаунчер має бути відкритим — його можна згорнути в трей.',
    launchOptionsError: 'Не вдалося налаштувати параметри запуску Steam: {{error}}',
    ok: 'Зрозуміло',
    restartSteamNow: 'Перезапустити Steam зараз',
    restartFailureTitle: 'Параметри запуску не застосовано',
    restartSuccessTitle: 'Параметри запуску застосовано',
    restartSuccessMessage: 'Параметри запуску записано. Можна запускати гру.',
  },
  installUnavailable: {
    title: 'Недоступно',
    message: 'Встановлення доступне тільки в десктопній версії застосунку',
  },
  launch: {
    errorTitle: 'Помилка запуску',
    failed: 'Не вдалося запустити гру',
    gameNotFound: "Гру не знайдено на вашому комп'ютері",
    lutrisFailed: 'Не вдалося запустити гру через Lutris',
  },
  launchOptions: {
    noAppId: 'Гра не має Steam App ID',
    notConfigured: 'Для цього перекладу не задано параметрів запуску',
    gameDirUnresolved: 'Не вдалося визначити теку гри для параметрів запуску',
    writeFailed: 'Не вдалося записати параметри запуску',
  },
  millennium: {
    deckyHost:
      'Millennium несумісний із Decky Loader, тож тут переклад досягнень показується через плагін «LBK Bridge» для Decky Loader.',
    unsupported: {
      'flatpak-steam': 'Millennium не підтримує Steam, встановлений через Flatpak.',
      'snap-steam': 'Millennium не підтримує Steam, встановлений через Snap.',
      arch: "Millennium працює лише на комп'ютерах з процесором x86-64.",
      'steam-rt64':
        'Millennium не працює з 64-бітною бета-версією клієнта Steam. Вийдіть із бета-програми в налаштуваннях Steam («Сумісність»/«Бета-версії»).',
      'missing-libssl32':
        'Бракує 32-бітної бібліотеки OpenSSL 3 (пакет libssl3:i386 або lib32-openssl). Встановіть її й спробуйте ще раз.',
      'steam-home-link':
        'Не знайдено ~/.steam/steam, який вказує на теку Steam. Запустіть Steam один раз і спробуйте ще раз.',
      nixos:
        'На NixOS встановіть Millennium засобами системи — лаунчер сам додасть до нього плагін «LBK Bridge».',
      'macos-too-old': 'Millennium потребує macOS 13.3 або новішої.',
      'no-release': 'Встановлення Millennium з лаунчера для цієї системи ще готується.',
      'millennium-v2':
        'У вас стара версія Millennium. Оновіть її до версії 3 офіційним інсталятором — після цього лаунчер сам додасть плагін «LBK Bridge».',
      'no-steam': 'Лаунчер не знайшов Steam на цьому пристрої.',
      unknown: 'Millennium не підтримується на цій системі.',
      noReleaseMac: 'Збірка Millennium для macOS ще готується.',
    },
    failure: {
      installFailed: 'Не вдалося встановити Millennium.',
      'download-failed':
        "Не вдалося завантажити Millennium. Перевірте з'єднання з інтернетом і спробуйте ще раз.",
      'checksum-mismatch':
        'Завантажений файл Millennium пошкоджено або підмінено. Встановлення скасовано.',
      'extract-failed': 'Не вдалося розпакувати Millennium.',
      'av-blocked':
        'Антивірус видалив або заблокував файли Millennium. Додайте теку Steam до винятків антивіруса й спробуйте ще раз.',
      'not-writable':
        'Лаунчер не має доступу на запис до теки Steam. Встановіть Millennium офіційним інсталятором.',
      conflict:
        'У теці Steam уже є файли іншого мода, який завантажується так само, як Millennium. Лаунчер не змінюватиме їх.',
      'not-prepared': 'Спершу завантажте Millennium ще раз.',
      'script-failed': 'Не вдалося встановити файли Millennium.',
      'files-locked':
        'Файли Steam ще зайняті. Millennium встановиться після наступного закриття Steam.',
      cancelled: 'Встановлення Millennium скасовано.',
      busy: 'Лаунчер уже змінює Millennium. Зачекайте, доки це завершиться.',
      'plugin-not-connected':
        'Millennium встановлено, але плагін «LBK Bridge» ще не підключився. Перевірте, чи Steam запущено, і натисніть «Перевірити ще раз».',
    },
    phase: {
      download: 'Завантаження Millennium…',
      verify: 'Перевірка файлів…',
      extract: 'Розпакування…',
      'stop-steam': 'Закриття Steam…',
      'install-files': 'Встановлення файлів…',
      'start-steam': 'Запуск Steam…',
      'wait-plugin': 'Очікування підключення плагіна «LBK Bridge»…',
      uninstallFiles: 'Видалення файлів Millennium…',
    },
  },
  millenniumPending: {
    notDetected:
      'Steam не відкрив канал для лаунчера. Параметри запуску застосовуватимуться після закриття Steam. Можливо, канал блокує інший мод Steam.',
    unsupported:
      'Виявлено Millennium, але лаунчер не зміг додати до нього плагін «LBK Bridge». Параметри запуску застосовуватимуться після закриття Steam.',
    enabled:
      'Плагін «LBK Bridge» для Millennium увімкнено, але Steam ще не завантажив його. Плагін запрацює після наступного запуску Steam.',
    disabled:
      'Виявлено Millennium. Він закриває канал, через який лаунчер працює зі Steam, тому лаунчер встановив плагін «LBK Bridge» для Millennium. Плагін увімкнеться автоматично, щойно ви закриєте Steam. Або увімкніть його вже зараз: налаштування Millennium → Plugins → LBK Bridge.',
  },
  millenniumSetup: {
    title: 'Millennium і плагін «LBK Bridge»',
    done: 'Millennium встановлено. Steam підключився до лаунчера через плагін «LBK Bridge».',
    offlineDone:
      'Millennium встановлено. Плагін «LBK Bridge» підключиться, щойно ви запустите Steam.',
    queued:
      'Millennium встановиться, щойно ви закриєте Steam. Якщо лаунчер на той момент буде закритий — під час його наступного запуску, коли Steam не працюватиме.',
    macQueued: 'Потім запускайте Steam з лаунчера або через «Steam Millennium».',
    steamNotBack:
      'Steam не запустився після встановлення Millennium. Можливо, ця версія Millennium ще не підтримує ваш Steam.',
    envMissing:
      'Steam запущено не з лаунчера, тому Millennium не активний. Перезапустіть Steam з лаунчера або повторно увійдіть у систему.',
    external:
      'Millennium уже встановлено — лаунчер сам додасть до нього плагін «LBK Bridge».',
    openSite: 'Відкрити сайт Millennium',
    startSteam: 'Запустити Steam',
    uninstall: 'Видалити Millennium',
    restartSteam: 'Перезапустити Steam',
    recheck: 'Перевірити ще раз',
    restartToFinish:
      'Щоб завершити встановлення, Steam потрібно закрити й запустити знову.',
    install: 'Встановити',
    update: 'Оновити Millennium',
    repair: 'Відновити Millennium',
    updateTitle: 'Оновлення Millennium',
    repairTitle: 'Відновлення Millennium',
    updateAvailable: 'Доступне оновлення Millennium: {{version}}.',
    filesBroken: 'Файли Millennium у теці Steam пошкоджено або видалено.',
    restartNeeded: 'Для цього Steam потрібно буде закрити й запустити знову.',
    offer: {
      intro:
        'Millennium — безкоштовний сторонній мод клієнта Steam (не від Valve). Лаунчер може встановити його разом із плагіном «LBK Bridge».',
      benefitsMac:
        'Що це дасть:\n• перекладені досягнення в бібліотеці, сповіщеннях і оверлеї Steam.',
      benefits:
        'Що це дасть:\n• перекладені досягнення в бібліотеці, сповіщеннях і оверлеї Steam;\n• лаунчер працюватиме зі Steam без відкритого порту налагодження і без запитів перезапустити Steam.',
      withoutMillennium:
        'Що працює й без Millennium: параметри запуску, підписки в Майстерні, колекція «З українізаторами», ярлик лаунчера та обкладинки в Steam — через порт налагодження Steam (після одного перезапуску Steam).',
      sourceMac: 'Файли завантажуються з нашої збірки Millennium на GitHub.',
      source: 'Файли Millennium завантажуються з офіційної сторінки проєкту на GitHub.',
      caveatWindows:
        'Зважте: після оновлень Steam Millennium іноді тимчасово не працює, доки не вийде його оновлення. Антивірус може помилково заблокувати його файли.',
      caveat:
        'Зважте: після оновлень Steam Millennium іноді тимчасово не працює, доки не вийде його оновлення.',
      linux:
        'Millennium буде встановлено лише для вашого користувача, без пароля адміністратора. Якщо запускати Steam не з лаунчера, Millennium запрацює після повторного входу в систему.',
      macos:
        'На macOS лаунчер встановлює власну збірку Millennium. Вона працює, лише коли Steam запущено через «Steam Millennium» у теці «Програми» вашого користувача — лаунчер сам запускає Steam саме так.',
      restart: 'Для встановлення Steam потрібно буде закрити й запустити знову.',
    },
  },
  millenniumUninstall: {
    title: 'Видалення Millennium',
    restartNeeded: 'Щоб видалити Millennium, Steam потрібно закрити й запустити знову.',
    cannotRestart:
      'Лаунчер не може перезапустити Steam зараз. Закрийте Steam самостійно.',
    confirm:
      'Millennium буде видалено з теки Steam. Плагіни й теми Millennium залишаться, якщо не позначити «Видалити також плагіни й налаштування Millennium».',
    purge: 'Видалити також плагіни й налаштування Millennium',
    action: 'Видалити Millennium',
    queued: 'Millennium буде видалено, щойно ви закриєте Steam.',
    done: 'Millennium видалено.',
    filesLocked:
      'Файли Steam ще зайняті. Millennium буде видалено після наступного закриття Steam.',
    failed: 'Не вдалося видалити Millennium.',
    failedWithError: 'Не вдалося видалити Millennium: {{error}}',
    progress: 'Видалення Millennium…',
  },
  notifications: {
    versionAvailable: 'Доступна версія {{version}}',
    teamNewGame: 'Нова локалізація від {{team}}',
    teamStatusChange: '{{team}}: стан змінено на "{{status}}"',
    feedbackReplyTitle: 'Відповідь на відгук: {{game}}',
  },
  pendingLaunchOptions: {
    queued_one: 'Очікують закриття Steam: параметри запуску для {{count}} гри.',
    queued_few: 'Очікують закриття Steam: параметри запуску для {{count}} ігор.',
    queued_many: 'Очікують закриття Steam: параметри запуску для {{count}} ігор.',
    queued_other: 'Очікують закриття Steam: параметри запуску для {{count}} ігор.',
    gameName: '«{{name}}»',
    games_one: '{{count}} гри',
    games_few: '{{count}} ігор',
    games_many: '{{count}} ігор',
    games_other: '{{count}} ігор',
    bridgeReady: 'Steam підключився до лаунчера',
    steamClosed: 'Steam закрито',
    appliedTitle: 'Параметри запуску застосовано',
    appliedBody:
      '{{lead}} — параметри запуску для {{target}} записано. Можна запускати гру.',
  },
  pluginEntries: {
    deckyPluginDisabled:
      'Плагін «LBK Bridge» вимкнено в Decky Loader. Увімкніть його в налаштуваннях Decky.',
    recommend:
      'Порада: з Millennium лаунчер також показуватиме в Steam переклад досягнень.',
    noDeckyCanInstall:
      'Переклад досягнень у Steam показує плагін «LBK Bridge» для Decky Loader. Лаунчер може встановити Decky Loader разом із плагіном.',
    noDecky:
      'Переклад досягнень у Steam показує плагін «LBK Bridge» для Decky Loader. Спершу встановіть Decky Loader.',
    deckyPlugin:
      'Плагін «LBK Bridge» для Decky Loader показує в Steam перекладені досягнення.',
    deckyOutdated: 'Доступне оновлення плагіна «LBK Bridge» для Decky.',
    pendingActivate: 'Millennium встановиться, щойно ви закриєте Steam.',
    pendingDeactivate: 'Millennium буде видалено, щойно ви закриєте Steam.',
    installedVersion: 'Встановлено Millennium {{version}}.',
    repair: 'Файли Millennium у теці Steam пошкоджено або видалено.',
    update: 'Доступне оновлення Millennium: {{version}}.',
    unsupported: 'Переклад досягнень у Steam недоступний: {{reason}}',
    bridgeUpdate: 'Оновлення плагіна «LBK Bridge» застосується після перезапуску Steam.',
  },
  pluginOffer: {
    installMillennium: 'Встановити Millennium',
    repairMillennium: 'Відновити Millennium',
    uninstallMillennium: 'Видалити Millennium',
    millenniumInfo: 'Що таке Millennium',
    millenniumSite: 'Відкрити сайт Millennium',
    installDeckyLoader: 'Встановити Decky Loader',
    installDeckyPlugin: 'Встановити плагін для Decky',
    updateDeckyPlugin: 'Оновити плагін для Decky',
    deckyInfo: 'Що таке Decky Loader',
    openSettings: 'Відкрити налаштування',
    restartSteam: 'Перезапустити Steam',
    updateMillennium: 'Оновити Millennium до {{version}}',
  },
  runInstaller: {
    exeTitle: 'Запуск інсталятора',
    scriptTitle: 'Запуск скрипта',
    exeProtonMessage:
      'Українізатор завантажено та розпаковано. Інсталятор для Windows буде запущено через вибрану версію Proton.\n\nШлях до папки буде скопійовано в буфер.',
    scriptProtonMessage:
      'Українізатор завантажено та розпаковано. Скрипт для Windows буде запущено через вибрану версію Proton.\n\nШлях до папки буде скопійовано в буфер.',
    exeAskMessage:
      'Українізатор завантажено та розпаковано.\n\nЗапустити інсталятор зараз?',
    scriptAskMessage:
      'Українізатор завантажено та розпаковано.\n\nЗапустити скрипт зараз?',
    protonPlaceholder: 'Оберіть версію Proton',
    openFolder: 'Відкрити папку',
    run: 'Так, запустити',
    skip: 'Ні',
    confirmMessage:
      'Після завантаження та розпакування українізатора буде запущено його інсталятор або скрипт.\n\nПродовжити встановлення?',
    confirm: 'Продовжити',
    finishedTitle: 'Інсталятор завершено',
    finishedMessage: 'Інсталятор успішно завершив роботу',
    failed: 'Не вдалося запустити інсталятор',
  },
  settings: {
    title: 'Налаштування',
    close: 'Закрити',
    feedback: {
      title: "Зворотний зв'язок",
      description: 'Написати нам у Telegram',
    },
    performance: {
      title: 'Режим продуктивності',
      weakHardware:
        'Увімкнено: на цьому пристрої недостатньо ресурсів для плавних анімацій, тому режим продуктивності не можна вимкнути',
      description: 'Вимикає анімації і блюр в інтерфейсі для кращої продуктивності',
    },
    liquidGlass: {
      title: 'Liquid Glass тема',
      weakHardware:
        'Вимкнено: на цьому пристрої недостатньо ресурсів для ефекту прозорості',
      description: 'Увімкнути ефект прозорості та розмиття для вікон (macOS 26+)',
    },
    backup: {
      title: 'Створювати резервну копію',
      description: 'Зберігати оригінальні файли гри перед встановленням українізатора',
    },
    steamCef: {
      title: 'Швидке застосування параметрів запуску Steam',
      description:
        'Дозволяє лаунчеру одразу, без перезапуску Steam, застосовувати параметри запуску, підписки в Майстерні, колекцію «З українізаторами» та обкладинки. Для цього в теці Steam створюється файл .cef-enable-remote-debugging (його ж використовує Decky Loader), і після увімкнення Steam потрібно один раз перезапустити. Якщо встановлено Millennium або Decky Loader, лаунчер додає до них плагін «LBK Bridge» — через нього Steam також показує переклад досягнень. Якщо вимкнути, параметри запуску застосовуватимуться лише після закриття Steam.',
    },
    steamArtwork: {
      title: 'Українські обкладинки в Steam',
      description:
        'Замінювати банер, логотип і горизонтальну обкладинку гри в бібліотеці Steam на українські версії з українізатора. Вертикальна обкладинка залишається оригінальною. Оригінали повертаються при видаленні українізатора або коли вимкнути цей перемикач',
    },
    adultGames: {
      title: 'Показувати ігри з порнографічним вмістом',
      description:
        'Дозволити відображення ігор з порнографічним/еротичним контентом (hentai, візуальні новели для дорослих тощо)',
    },
    aiTranslations: {
      title: 'Приховати ШІ-переклади',
      description: 'Сховати переклади, створені за допомогою штучного інтелекту',
    },
    recommendations: {
      title: 'Рекомендації ігор',
      description: 'Показувати блок «Вас може зацікавити» на сторінці гри',
    },
    notificationSounds: {
      title: 'Звуки сповіщень',
      description: 'Відтворювати звуки при отриманні сповіщень про оновлення',
    },
    gamepadSounds: {
      title: 'Звуки геймпада',
      description: 'Відтворювати звуки при навігації геймпадом',
    },
    productAnalytics: {
      title: 'Продуктова аналітика',
      description:
        'Сесії застосунку та взаємодії з інтерфейсом — допомагають зрозуміти, що в лаунчері незручно',
    },
    localizationAnalytics: {
      title: 'Аналітика розвитку локалізацій',
      description:
        'Підтримка авторів, пошук без результатів, видалення та час у грі — показують, яких перекладів бракує',
    },
    crashDiagnostics: {
      title: 'Звіти про збої',
      description:
        'Автоматичні звіти про помилки застосунку. Вимкнення діє одразу, увімкнення — після перезапуску',
    },
    collection: {
      title: 'Колекція «З українізаторами» в Steam',
      description:
        'Створити або оновити колекцію бібліотеки Steam з іграми, на які є переклад',
      updatedTitle: 'Колекція оновлена',
      updatedEmpty: 'У колекції «З українізаторами» тепер немає ігор.',
      updated_one: 'У колекції «З українізаторами» тепер {{count}} гра.',
      updated_few: 'У колекції «З українізаторами» тепер {{count}} гри.',
      updated_many: 'У колекції «З українізаторами» тепер {{count}} ігор.',
      updated_other: 'У колекції «З українізаторами» тепер {{count}} гри.',
      failedTitle: 'Не вдалося оновити колекцію',
    },
    kurin: {
      title: 'Синхронізація з Kurin`',
      description: 'Знайти встановлені ігри, додані через Kurin`, та імпортувати їх',
      failedTitle: 'Не вдалося синхронізувати',
      doneTitle: 'Синхронізація завершена',
      synced_one: 'Синхронізовано {{count}} гру: {{games}}',
      synced_few: 'Синхронізовано {{count}} гри: {{games}}',
      synced_many: 'Синхронізовано {{count}} ігор: {{games}}',
      synced_other: 'Синхронізовано {{count}} гри: {{games}}',
      none: 'Не знайдено ігор, встановлених через Kurin, або Kurin не встановлено.',
    },
    lbkShortcut: {
      title: 'LBK Launcher в бібліотеці Steam',
      description: 'Додати лаунчер як гру в Steam',
      addedTitle: 'Готово',
      addedMessage: 'LBK Launcher додано в бібліотеку Steam.',
      failedTitle: 'Не вдалося додати в Steam',
      errorTitle: 'Сталася помилка',
      errorMessage: 'Спробуйте ще раз пізніше.',
    },
    unexpectedError: 'Сталася непередбачена помилка.',
    clearCache: {
      title: 'Очистити кеш',
      description: 'Видалити тимчасові файли (зберігає налаштування)',
      confirmMessage:
        'Буде видалено тимчасові файли та базу даних. Налаштування збережуться. Застосунок перезапуститься.',
      confirmAction: 'Очистити',
    },
    clearAll: {
      title: 'Очистити всі дані',
      description: 'Видалити налаштування, підписки та всі дані',
      confirmMessage:
        'Буде видалено всі дані, включаючи налаштування та підписки. Застосунок перезапуститься.',
      confirmAction: 'Видалити все',
    },
    dev: {
      title: 'Dev налаштування',
      notificationSounds: 'Звуки сповіщень:',
      soundStatus: 'Стан',
      soundVersion: 'Версія',
      soundApp: 'Застосунок',
      soundProgress: 'Прогрес',
      soundNewGame: 'Нова гра',
      soundTeam: 'Команда',
      gamepadSounds: 'Звуки геймпада:',
      navigate: 'Навігація',
      confirm: 'Підтвердити',
      back: 'Назад',
      promoMode: 'Режим показу промо банера:',
      promoNormal: 'Звичайний (24 год + галочка)',
      promoAlways: 'Завжди показувати',
      promoNever: 'Ніколи не показувати',
      promoPlaceholder: 'Оберіть режим',
    },
    logs: {
      title: 'Відкрити папку з логами',
      description: 'Переглянути збережені файли логів',
      send: 'Відправити файл',
    },
    unlock: {
      title: 'Розблокувати прихований переклад',
      placeholder: 'Код перекладу',
      action: 'Розблокувати',
    },
    changelog: {
      title: 'Що нового',
      description: 'Історія оновлень · v{{version}}',
    },
    legal: {
      terms: 'Умови використання',
      privacy: 'Політика конфіденційності',
    },
    credits: {
      title: 'Подяки',
      description:
        'Особлива подяка перекладачам, які долучились до тестування з перших днів і допомогають робити цей лаунчер таким, яким він є:',
    },
    bridgeCard: {
      steamElevated:
        'Steam запущено від імені адміністратора, тому лаунчер не може його перезапустити.',
      restart: 'Перезапустити Steam',
      recheck: 'Перевірити ще раз',
    },
  },
  steamActionErrors: {
    steamNotRunning: 'Steam не запущено. Запустіть Steam і спробуйте ще раз.',
    cefUnavailable:
      'Увімкніть налаштування «Швидке застосування параметрів запуску Steam» і перезапустіть Steam, щоб лаунчер міг {{purpose}}.',
    cefBlocked:
      'Steam не відкрив канал для лаунчера навіть після перезапуску. Щоб лаунчер міг {{purpose}}, перевірте, чи не блокує його інший мод Steam, і натисніть «Перевірити ще раз» у налаштуваннях.',
    millenniumPluginPending:
      'Millennium закриває канал, через який лаунчер працює зі Steam. Плагін «LBK Bridge» увімкнеться після наступного закриття Steam — тоді лаунчер зможе {{purpose}}. Або увімкніть його вже зараз у налаштуваннях Millennium (Plugins).',
    millenniumOutdated:
      'Ваша версія Millennium застаріла. Оновіть Millennium до версії 3, щоб лаунчер міг {{purpose}}.',
    libraryUnavailable: 'Бібліотека Steam ще завантажується. Спробуйте за кілька секунд.',
    noTranslatedGames:
      'У каталозі немає перекладів до ігор Steam. Якщо каталог ще синхронізується, спробуйте за хвилину.',
    noMatches: 'Серед ваших ігор у бібліотеці Steam немає жодної з перекладом.',
    failed: 'Спробуйте ще раз пізніше.',
  },
  steamActionPurposes: {
    manageCollections: 'керувати колекціями',
    addShortcut: 'додати ярлик у бібліотеку',
  },
  steamCollection: {
    name: 'З українізаторами',
  },
  steamRestart: {
    steamNotStarted: 'Steam не запустився',
    failed: 'Не вдалося перезапустити Steam',
    progressTitle: 'Перезапуск Steam',
    progressMessage:
      'Лаунчер закриває і знову запускає Steam. Це може тривати до двох хвилин.',
    unknownError: 'Невідома помилка',
    failedTitle: 'Steam не перезапущено',
    restartedTitle: 'Steam перезапущено',
  },
  steamRestartFailure: {
    launchFailed:
      'Steam закрито, але не вдалося запустити його знову. Запустіть Steam вручну.',
    accessDenied: {
      launchOptions:
        'Steam запущено від імені адміністратора, тому лаунчер не може його перезапустити. Закрийте Steam самостійно — параметри запуску застосуються автоматично.',
      plain:
        'Steam запущено від імені адміністратора, тому лаунчер не може його перезапустити. Перезапустіть Steam самостійно.',
    },
    gamescope: {
      launchOptions:
        'В ігровому режимі лаунчер не перезапускає Steam. Параметри запуску застосуються, щойно Steam буде закрито — наприклад, після переходу в режим робочого столу.',
      plain:
        'В ігровому режимі лаунчер не перезапускає Steam. Перезапустіть його самостійно — наприклад, перейдіть у режим робочого столу.',
    },
    gameRunning: {
      launchOptions:
        'Закрийте гру, щоб перезапустити Steam. Параметри запуску застосуються, щойно Steam буде закрито.',
      plain: 'Закрийте гру, щоб перезапустити Steam.',
    },
    timeout: {
      launchOptions:
        'Steam не закрився вчасно. Закрийте його вручну — параметри запуску застосуються автоматично.',
      plain: 'Steam не закрився вчасно. Перезапустіть його вручну.',
    },
    generic: 'Не вдалося перезапустити Steam.',
  },
  steamRestartPrompt: {
    title: 'Перезапустіть Steam',
    message:
      'Щоб зміни набули чинності, потрібно перезапустити Steam. Можна зробити це пізніше — налаштування вже збережено.',
    restartAction: 'Перезапустити Steam',
  },
  titleBar: {
    offlineSuffix: ' · ви оффлайн',
  },
  translationProgress: {
    translation: 'Переклад',
    editing: 'Редактура',
    voice: 'Озвучення',
    textures: 'Текстури',
    fonts: 'Шрифти',
  },
  tray: {
    open: 'Відкрити',
    quit: 'Вийти',
  },
  uninstall: {
    title: 'Видалення українізатора',
    message:
      'Ви впевнені, що хочете видалити українізатор для "{{name}}"?\n\n{{backupWarning}}',
    noBackupWarning:
      'УВАГА: Резервну копію не було створено при встановленні. Оригінальні файли НЕ будуть відновлені!',
    backupWarning: 'Оригінальні файли гри будуть відновлені з резервної копії.',
    confirm: 'Видалити',
    doneTitle: 'Українізатор видалено',
    doneMessage: 'Українізатор "{{name}}" успішно видалено!',
    notInstalled: 'Українізатор не встановлено',
    failed: 'Помилка видалення: {{error}}',
    removeComponentsFailed: 'Помилка видалення компонентів: {{error}}',
  },
} as const;
